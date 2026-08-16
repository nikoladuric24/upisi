import { createHmac, randomInt } from "node:crypto";

type PortalType = "FACULTY_ADMISSIONS" | "SECONDARY_ADMISSIONS";

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.EMATICA_SERVICE_SECRET || "upisi-local-session-secret";
}

function getPinPepper(): string {
  return process.env.ADMISSIONS_PIN_PEPPER || getSecret();
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function normalizeEmail(value: string): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const withDomain = raw.includes("@") ? raw : `${raw}@skolehr.xyz`;
  return withDomain
    .replace(/@eskole\.hr$/i, "@skolehr.xyz")
    .replace(/@eskole\.me$/i, "@skolehr.xyz");
}

function verifyActivationToken(token: string): any | null {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature || signPayload(payload) !== signature) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "hex").toString("utf8"));
    if (!data?.expiresAt || new Date(data.expiresAt).getTime() <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function normalizeCountryCode(value: string): string {
  const raw = String(value || "+385").trim();
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : "+385";
}

function normalizePhoneNumber(value: string): string {
  return String(value || "").replace(/[^\d]/g, "").replace(/^0+/, "");
}

function formatPhone(countryCode: string, phoneNumber: string): string {
  return `${normalizeCountryCode(countryCode)}${normalizePhoneNumber(phoneNumber)}`;
}

function hashPin(email: string, portalType: PortalType, pin: string): string {
  return createHmac("sha256", getPinPepper())
    .update(`${portalType}:${normalizeEmail(email)}:${String(pin || "").trim()}`)
    .digest("hex");
}

function createDeterministicMockPin(email: string, portalType: PortalType): string {
  const digest = createHmac("sha256", getPinPepper()).update(`${portalType}:${normalizeEmail(email)}`).digest("hex");
  return String(parseInt(digest.slice(0, 8), 16) % 10000).padStart(4, "0");
}

function generatePin(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url, key, isConfigured: Boolean(url && key) };
}

async function getStoredPin(email: string, portalType: PortalType): Promise<any | null> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;

  const query = `?select=*&email=eq.${encodeURIComponent(normalizeEmail(email))}&portal_type=eq.${portalType}&limit=1`;
  const response = await fetch(`${config.url}/rest/v1/admissions_login_pins${query}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`
    }
  });
  const raw = await response.text();
  if (!response.ok) {
    console.error("[ADMISSIONS_PIN] Supabase read failed", response.status, raw);
    throw new Error(raw || "Ne mogu dohvatiti PIN iz baze.");
  }

  const rows = raw ? JSON.parse(raw) : [];
  return rows?.[0] || null;
}

async function resolvePinForSending(email: string, portalType: PortalType): Promise<string> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return createDeterministicMockPin(email, portalType);

  const existing = await getStoredPin(email, portalType);
  if (existing?.pin_hash) {
    for (let candidate = 0; candidate <= 9999; candidate += 1) {
      const pin = String(candidate).padStart(4, "0");
      if (hashPin(email, portalType, pin) === existing.pin_hash) return pin;
    }
  }

  return generatePin();
}

async function savePinForStudent(params: {
  email: string;
  portalType: PortalType;
  pin: string;
  phoneCountry: string;
  phoneNumber: string;
}) {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;

  const now = new Date().toISOString();
  const payload = {
    email: normalizeEmail(params.email),
    portal_type: params.portalType,
    phone_country: normalizeCountryCode(params.phoneCountry),
    phone_number: normalizePhoneNumber(params.phoneNumber),
    pin_hash: hashPin(params.email, params.portalType, params.pin),
    updated_at: now,
    last_sent_at: now
  };

  const response = await fetch(`${config.url}/rest/v1/admissions_login_pins?on_conflict=email,portal_type`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error("[ADMISSIONS_PIN] Supabase upsert failed", response.status, raw);
    throw new Error(raw || "Ne mogu spremiti PIN u bazu.");
  }

  return raw ? JSON.parse(raw) : null;
}

async function sendSms(params: { to: string; message: string }) {
  const provider = (process.env.SMS_PROVIDER || "mock").toLowerCase();

  if (provider !== "twilio") {
    console.log("[SMS_MOCK]", { to: params.to, message: params.message });
    return { provider: "mock", mocked: true };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || "";
  const from = process.env.TWILIO_FROM_NUMBER || "";

  if (!accountSid || !authToken || (!messagingServiceSid && !from)) {
    throw new Error("Twilio SMS nije konfiguriran.");
  }

  const body = new URLSearchParams({ To: params.to, Body: params.message });
  if (messagingServiceSid) body.set("MessagingServiceSid", messagingServiceSid);
  else body.set("From", from);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error("[SMS_TWILIO] send failed", response.status, raw);
    throw new Error(raw || "Twilio nije poslao SMS.");
  }

  const result = raw ? JSON.parse(raw) : {};
  return { provider: "twilio", sid: result.sid };
}

function getPortalLabel(portalType: string): string {
  return portalType === "FACULTY_ADMISSIONS" ? "Postani student" : "e-Srednje";
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method Not Allowed", allowed: ["POST"] });
  }

  const activationToken = String(req.body?.activationToken || "");
  const activation = verifyActivationToken(activationToken);
  if (!activation?.email || !activation?.portalType) {
    return res.status(401).json({
      success: false,
      error: "Aktivacijski zahtjev je istekao. Ponovno unesite korisnicko ime i lozinku."
    });
  }

  const email = normalizeEmail(activation.email);
  const portalType = activation.portalType as PortalType;
  const phoneCountry = normalizeCountryCode(req.body?.countryCode || req.body?.phoneCountry || "+385");
  const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber || "");

  if (!phoneNumber || phoneNumber.length < 6) {
    return res.status(400).json({ success: false, error: "Unesite ispravan broj telefona." });
  }

  try {
    const pin = await resolvePinForSending(email, portalType);
    await savePinForStudent({
      email,
      portalType,
      pin,
      phoneCountry,
      phoneNumber
    });

    const to = formatPhone(phoneCountry, phoneNumber);
    const portalLabel = getPortalLabel(portalType);
    const message = `${portalLabel}: vas PIN za prijavu je ${pin}. PIN je trajan i cuvajte ga za buduce prijave.`;
    const sms = await sendSms({ to, message });

    console.log("[ADMISSIONS_PIN] PIN sent", {
      email,
      portalType,
      to,
      provider: sms.provider,
      mocked: sms.mocked,
      sid: sms.sid
    });

    return res.status(200).json({
      success: true,
      message: "PIN je poslan SMS porukom. Vratite se na prijavu i unesite korisnicko ime, lozinku i PIN.",
      smsProvider: sms.provider,
      mocked: Boolean(sms.mocked)
    });
  } catch (error: any) {
    console.error("[ADMISSIONS_PIN] request failed", {
      email,
      portalType,
      message: error?.message,
      stack: error?.stack
    });
    return res.status(500).json({
      success: false,
      error: error?.message || "Slanje PIN-a nije uspjelo."
    });
  }
}
