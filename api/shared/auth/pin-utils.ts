import { createHmac, randomInt } from "node:crypto";

export type PortalType = "FACULTY_ADMISSIONS" | "SECONDARY_ADMISSIONS";

export interface StoredPinRecord {
  id?: string;
  email: string;
  portal_type: PortalType;
  phone_country: string;
  phone_number: string;
  pin_hash: string;
  last_sent_at?: string;
  created_at?: string;
  updated_at?: string;
}

const ACTIVATION_MAX_AGE_SECONDS = 10 * 60;

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.EMATICA_SERVICE_SECRET || "upisi-local-session-secret";
}

function getPinPepper(): string {
  return process.env.ADMISSIONS_PIN_PEPPER || getSecret();
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createActivationToken(data: Record<string, unknown>): string {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({
    ...data,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ACTIVATION_MAX_AGE_SECONDS * 1000).toISOString()
  })).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function verifyActivationToken(token: string): any | null {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature || signPayload(payload) !== signature) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.expiresAt || new Date(data.expiresAt).getTime() <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function normalizeEmail(value: string): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const withDomain = raw.includes("@") ? raw : `${raw}@skolehr.xyz`;
  return withDomain
    .replace(/@eskole\.hr$/i, "@skolehr.xyz")
    .replace(/@eskole\.me$/i, "@skolehr.xyz");
}

export function normalizeCountryCode(value: string): string {
  const raw = String(value || "+385").trim();
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : "+385";
}

export function normalizePhoneNumber(value: string): string {
  return String(value || "").replace(/[^\d]/g, "").replace(/^0+/, "");
}

export function formatPhone(countryCode: string, phoneNumber: string): string {
  return `${normalizeCountryCode(countryCode)}${normalizePhoneNumber(phoneNumber)}`;
}

export function generatePin(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

export function createDeterministicMockPin(email: string, portalType: PortalType): string {
  const digest = createHmac("sha256", getPinPepper()).update(`${portalType}:${normalizeEmail(email)}`).digest("hex");
  return String(parseInt(digest.slice(0, 8), 16) % 10000).padStart(4, "0");
}

export function hashPin(email: string, portalType: PortalType, pin: string): string {
  return createHmac("sha256", getPinPepper())
    .update(`${portalType}:${normalizeEmail(email)}:${String(pin || "").trim()}`)
    .digest("hex");
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return {
    url: url.replace(/\/$/, ""),
    key,
    isConfigured: Boolean(url && key)
  };
}

function tableUrl(path = ""): string {
  const { url } = getSupabaseConfig();
  return `${url}/rest/v1/admissions_login_pins${path}`;
}

function supabaseHeaders(extra?: Record<string, string>): Record<string, string> {
  const { key } = getSupabaseConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra
  };
}

export async function getStoredPin(email: string, portalType: PortalType): Promise<StoredPinRecord | null> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;

  const query = `?select=*&email=eq.${encodeURIComponent(normalizeEmail(email))}&portal_type=eq.${portalType}&limit=1`;
  const response = await fetch(tableUrl(query), {
    method: "GET",
    headers: supabaseHeaders()
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error("[ADMISSIONS_PIN] Supabase read failed", response.status, raw);
    throw new Error(raw || "Ne mogu dohvatiti PIN iz baze.");
  }

  const rows = raw ? JSON.parse(raw) : [];
  return rows?.[0] || null;
}

export async function upsertStoredPin(record: StoredPinRecord): Promise<StoredPinRecord | null> {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;

  const now = new Date().toISOString();
  const payload = {
    ...record,
    email: normalizeEmail(record.email),
    updated_at: now,
    last_sent_at: now
  };

  const response = await fetch(tableUrl("?on_conflict=email,portal_type"), {
    method: "POST",
    headers: supabaseHeaders({
      Prefer: "resolution=merge-duplicates,return=representation"
    }),
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error("[ADMISSIONS_PIN] Supabase upsert failed", response.status, raw);
    throw new Error(raw || "Ne mogu spremiti PIN u bazu.");
  }

  const rows = raw ? JSON.parse(raw) : [];
  return rows?.[0] || null;
}

export async function resolvePinForSending(email: string, portalType: PortalType): Promise<string> {
  const existing = await getStoredPin(email, portalType);
  if (!getSupabaseConfig().isConfigured) {
    return createDeterministicMockPin(email, portalType);
  }

  if (existing?.pin_hash) {
    for (let candidate = 0; candidate <= 9999; candidate += 1) {
      const pin = String(candidate).padStart(4, "0");
      if (hashPin(email, portalType, pin) === existing.pin_hash) return pin;
    }
  }

  return generatePin();
}

export async function savePinForStudent(params: {
  email: string;
  portalType: PortalType;
  pin: string;
  phoneCountry: string;
  phoneNumber: string;
}): Promise<void> {
  await upsertStoredPin({
    email: normalizeEmail(params.email),
    portal_type: params.portalType,
    phone_country: normalizeCountryCode(params.phoneCountry),
    phone_number: normalizePhoneNumber(params.phoneNumber),
    pin_hash: hashPin(params.email, params.portalType, params.pin)
  });
}

export async function verifyStudentPin(email: string, portalType: PortalType, pin: string): Promise<boolean> {
  const cleanPin = String(pin || "").trim();
  if (!/^\d{4}$/.test(cleanPin)) return false;

  const stored = await getStoredPin(email, portalType);
  if (!getSupabaseConfig().isConfigured) {
    return cleanPin === createDeterministicMockPin(email, portalType);
  }

  if (!stored?.pin_hash) return false;
  return stored.pin_hash === hashPin(email, portalType, cleanPin);
}

export async function sendSms(params: {
  to: string;
  message: string;
}): Promise<{ provider: string; sid?: string; mocked?: boolean }> {
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
    throw new Error("Twilio SMS nije konfiguriran. Postavite TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN i TWILIO_MESSAGING_SERVICE_SID ili TWILIO_FROM_NUMBER.");
  }

  const body = new URLSearchParams({
    To: params.to,
    Body: params.message
  });

  if (messagingServiceSid) {
    body.set("MessagingServiceSid", messagingServiceSid);
  } else {
    body.set("From", from);
  }

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
