import { createHmac } from "node:crypto";

type PortalType = "FACULTY_ADMISSIONS" | "SECONDARY_ADMISSIONS";

const COOKIE_NAME = "eduportal_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.EMATICA_SERVICE_SECRET || "upisi-local-session-secret";
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function createSignedSession(user: any, roles: string[], portalType: PortalType, source = "ednevnik"): string {
  const now = Date.now();
  const session = {
    user,
    roles,
    portalType,
    source,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_MAX_AGE_SECONDS * 1000).toISOString()
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

function setSessionCookie(res: any, token: string): void {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`
  );
}

function normalizeEmail(value: string): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const withDomain = raw.includes("@") ? raw : `${raw}@skolehr.xyz`;
  return withDomain
    .replace(/@eskole\.hr$/i, "@skolehr.xyz")
    .replace(/@eskole\.me$/i, "@skolehr.xyz");
}

function getPinPepper(): string {
  return process.env.ADMISSIONS_PIN_PEPPER || getSecret();
}

function createActivationToken(data: Record<string, unknown>): string {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({
    ...data,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60 * 1000).toISOString()
  }), "utf8").toString("hex");
  return `${payload}.${signPayload(payload)}`;
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

async function getStoredPin(email: string, portalType: PortalType): Promise<any | null> {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) return null;

  const query = `?select=*&email=eq.${encodeURIComponent(normalizeEmail(email))}&portal_type=eq.${portalType}&limit=1`;
  const response = await fetch(`${supabaseUrl}/rest/v1/admissions_login_pins${query}`, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error("[UPISI_LOGIN] PIN read failed", response.status, raw);
    throw new Error(raw || "Ne mogu dohvatiti PIN.");
  }

  const rows = raw ? JSON.parse(raw) : [];
  return rows?.[0] || null;
}

async function verifyStudentPin(email: string, portalType: PortalType, pin: string): Promise<boolean> {
  const cleanPin = String(pin || "").trim();
  if (!/^\d{4}$/.test(cleanPin)) return false;

  const supabaseConfigured = Boolean((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseConfigured) {
    return cleanPin === createDeterministicMockPin(email, portalType);
  }

  const stored = await getStoredPin(email, portalType);
  if (!stored?.pin_hash) return false;
  return stored.pin_hash === hashPin(email, portalType, cleanPin);
}

function resolvePortalFromHost(hostname: string): PortalType {
  const cleanHost = hostname.toLowerCase().split(":")[0].replace(/\.$/, "");
  if (cleanHost === "postani-student.skolehr.xyz" || cleanHost === "fakulteti.skolehr.xyz") {
    return "FACULTY_ADMISSIONS";
  }
  return "SECONDARY_ADMISSIONS";
}

function mapEdnevnikRolesToPortalRole(roles: string[], portalType: PortalType): string {
  const normalized = roles.map((role) => String(role || "").toUpperCase());
  if (normalized.some((role) => ["SUPER_ADMIN", "MAIN_ADMIN"].includes(role))) return "SUPER_ADMIN";
  if (normalized.some((role) => ["PRIMARY_STUDENT", "ELEMENTARY_STUDENT", "BASIC_STUDENT"].includes(role))) return "PRIMARY_STUDENT";
  if (normalized.some((role) => ["SECONDARY_STUDENT", "HIGH_SCHOOL_STUDENT"].includes(role))) return "SECONDARY_STUDENT";
  if (normalized.some((role) => ["PRIMARY_ADMIN", "ELEMENTARY_ADMIN"].includes(role))) return "PRIMARY_ADMIN";
  if (normalized.some((role) => ["SECONDARY_ADMIN", "HIGH_SCHOOL_ADMIN"].includes(role))) return "SECONDARY_ADMIN";
  if (normalized.some((role) => ["PRIMARY_HOMEROOM_TEACHER", "ELEMENTARY_HOMEROOM_TEACHER"].includes(role))) return "PRIMARY_HOMEROOM_TEACHER";
  if (normalized.some((role) => ["SECONDARY_HOMEROOM_TEACHER", "HIGH_SCHOOL_HOMEROOM_TEACHER"].includes(role))) return "SECONDARY_HOMEROOM_TEACHER";
  if (portalType === "FACULTY_ADMISSIONS" && normalized.some((role) => ["UNIVERSITY_ADMIN", "FACULTY_ADMIN"].includes(role))) return "UNIVERSITY_ADMIN";
  if (normalized.some((role) => ["ADMIN", "SCHOOL_ADMIN"].includes(role))) {
    return portalType === "FACULTY_ADMISSIONS" ? "SECONDARY_ADMIN" : "PRIMARY_ADMIN";
  }
  if (normalized.some((role) => ["HOMEROOM", "HOMEROOM_TEACHER", "DEPUTY", "TEACHER", "STAFF"].includes(role))) {
    return portalType === "FACULTY_ADMISSIONS" ? "SECONDARY_HOMEROOM_TEACHER" : "PRIMARY_HOMEROOM_TEACHER";
  }
  return portalType === "FACULTY_ADMISSIONS" ? "SECONDARY_STUDENT" : "PRIMARY_STUDENT";
}

function isStudentPortalRole(role: string): boolean {
  return role === "PRIMARY_STUDENT" || role === "SECONDARY_STUDENT";
}

function isStaffPortalRole(role: string): boolean {
  return !isStudentPortalRole(role);
}

function isRoleAllowedOnPortal(role: string, portalType: PortalType): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (portalType === "SECONDARY_ADMISSIONS") {
    return ["PRIMARY_STUDENT", "PRIMARY_HOMEROOM_TEACHER", "PRIMARY_ADMIN", "SECONDARY_ADMIN"].includes(role);
  }
  return ["SECONDARY_STUDENT", "SECONDARY_HOMEROOM_TEACHER", "SECONDARY_ADMIN", "UNIVERSITY_ADMIN"].includes(role);
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method Not Allowed", allowed: ["POST"] });
  }

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const portalType = resolvePortalFromHost(host);
  const normalizedEmail = normalizeEmail(req.body?.email || req.body?.username);
  const password = String(req.body?.password || "");
  const pin = String(req.body?.pin || "");
  const explicitTotpCode = req.body?.totpCode || req.body?.authenticatorCode || req.body?.code;
  const ednevnikBaseUrl = (process.env.EDNEVNIK_AUTH_BASE_URL || process.env.EDNEVNIK_BASE_URL || "").replace(/\/$/, "");

  console.log("[UPISI_LOGIN] request", {
    host,
    portalType,
    normalizedEmail,
    hasPassword: Boolean(password),
    hasPin: Boolean(pin),
    hasExplicitTotpCode: Boolean(explicitTotpCode),
    hasEdnevnikBaseUrl: Boolean(ednevnikBaseUrl)
  });

  if (!normalizedEmail || !password) {
    return res.status(400).json({ success: false, error: "Unesite korisnicko ime i lozinku." });
  }

  if (!ednevnikBaseUrl) {
    return res.status(500).json({
      success: false,
      error: "EDNEVNIK_AUTH_BASE_URL nije postavljen na Vercelu."
    });
  }

  try {
    const hasPin = /^\d{4}$/.test(pin.trim());
    const looksLikeStaffLogin = /^\d{6}$/.test(password.trim()) && hasPin;
    const loginAttempts = !pin
      ? [
          {
            mode: "STUDENT",
            payload: {
              email: normalizedEmail,
              username: normalizedEmail,
              password,
              pin: password,
              loginType: "STUDENT"
            }
          }
        ]
      : looksLikeStaffLogin
      ? [
          {
            mode: "STAFF",
            payload: {
              email: normalizedEmail,
              username: normalizedEmail,
              password: pin,
              pin,
              loginType: "STAFF",
              totpCode: explicitTotpCode || password
            }
          },
          {
            mode: "STUDENT",
            payload: {
              email: normalizedEmail,
              username: normalizedEmail,
              password,
              pin: password,
              loginType: "STUDENT",
              admissionsPin: pin
            }
          }
        ]
      : [
          {
            mode: "STUDENT",
            payload: {
              email: normalizedEmail,
              username: normalizedEmail,
              password,
              pin: password,
              loginType: "STUDENT",
              admissionsPin: pin
            }
          },
          {
            mode: "STAFF",
            payload: {
              email: normalizedEmail,
              username: normalizedEmail,
              password: pin,
              pin,
              loginType: "STAFF",
              totpCode: explicitTotpCode || password
            }
          }
        ];

    let upstreamResponse: Response | null = null;
    let result: any = null;
    let selectedMode = loginAttempts[0].mode;

    for (const attempt of loginAttempts) {
      upstreamResponse = await fetch(`${ednevnikBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt.payload)
      });

      const raw = await upstreamResponse.text();
      result = null;
      if (raw) {
        try {
          result = JSON.parse(raw);
        } catch {
          result = { raw };
        }
      }

      console.log("[UPISI_LOGIN] ednevnik result", {
        mode: attempt.mode,
        status: upstreamResponse.status,
        ok: upstreamResponse.ok,
        hasUser: Boolean(result?.user),
        hasProfile: Boolean(result?.profile),
        roles: result?.roles
      });

      selectedMode = attempt.mode;
      if (upstreamResponse.ok && result?.success !== false) {
        break;
      }
    }

    if (!upstreamResponse) {
      return res.status(502).json({ success: false, error: "e-Dnevnik prijava nije pokrenuta." });
    }

    /*
      Login mapping:
      - Student: KORISNICKO IME + LOZINKA = e-Dnevnik credentials, PIN = e-Upisi SMS PIN.
      - Staff:   KORISNICKO IME + PIN = e-Dnevnik internal PIN, LOZINKA = authenticator code.
    */
    const lastPayloadShape = {
      email: normalizedEmail,
      mode: selectedMode,
      hasPassword: true,
      hasPin: true
    };
    console.log("[UPISI_LOGIN] selected mapping", lastPayloadShape);

    /*
      The e-Dnevnik API validates the e-Dnevnik credentials. The admissions PIN is
      passed as admissionsPin so the central system can validate it when that
      endpoint supports the field.
    */

    if (!upstreamResponse.ok || result?.success === false) {
      return res.status(upstreamResponse.status || 502).json({
        success: false,
        error: result?.error || result?.message || "e-Dnevnik je odbio prijavu."
      });
    }

    const ednevnikUser = result?.user || result?.profile || result?.data?.user;
    if (!ednevnikUser) {
      return res.status(502).json({
        success: false,
        error: "e-Dnevnik nije vratio podatke korisnika."
      });
    }

    const roles = Array.isArray(result?.roles)
      ? result.roles
      : [ednevnikUser.role, ednevnikUser.access_role, result?.role].filter(Boolean);
    const role = mapEdnevnikRolesToPortalRole(roles, portalType);

    if (!isRoleAllowedOnPortal(role, portalType)) {
      return res.status(403).json({
        success: false,
        error: portalType === "FACULTY_ADMISSIONS"
          ? "Nemate pravo pristupa sustavu Postani student s ovim korisnickim racunom."
          : "Nemate pravo pristupa sustavu e-Srednje s ovim korisnickim racunom."
      });
    }

    if (!pin) {
      if (isStaffPortalRole(role)) {
        return res.status(400).json({
          success: false,
          error: "Djelatnici moraju unijeti interni PIN i kod iz autentifikatora."
        });
      }

      return res.status(200).json({
        success: true,
        requiresPinSetup: true,
        activationToken: createActivationToken({
          email: normalizedEmail,
          portalType,
          role,
          source: "ednevnik"
        }),
        message: "Ovo je prva prijava. Unesite broj mobitela za slanje 4-znamenkastog PIN-a."
      });
    }

    if (isStudentPortalRole(role)) {
      const pinOk = await verifyStudentPin(normalizedEmail, portalType, pin);
      console.log("[UPISI_LOGIN] admissions PIN check", {
        normalizedEmail,
        portalType,
        pinOk
      });

      if (!pinOk) {
        return res.status(401).json({
          success: false,
          error: "PIN nije ispravan ili jos nije izdan. Ako je ovo prva prijava, ostavite PIN praznim."
        });
      }
    } else if (!hasPin) {
      return res.status(400).json({
        success: false,
        error: "Djelatnici moraju unijeti 4-znamenkasti interni PIN."
      });
    }

    const fullName = ednevnikUser.fullName
      || ednevnikUser.full_name
      || [ednevnikUser.first_name, ednevnikUser.last_name].filter(Boolean).join(" ")
      || normalizedEmail;
    const user = {
      id: String(ednevnikUser.id || ednevnikUser.user_id || normalizedEmail),
      email: String(ednevnikUser.email || normalizedEmail).toLowerCase(),
      fullName,
      role,
      createdAt: ednevnikUser.createdAt || ednevnikUser.created_at || new Date().toISOString()
    };

    const token = createSignedSession(user, roles, portalType);
    setSessionCookie(res, token);

    return res.status(200).json({
      success: true,
      user,
      roles,
      portalType,
      source: "ednevnik"
    });
  } catch (error: any) {
    console.error("[UPISI_LOGIN] proxy failed", {
      message: error?.message,
      stack: error?.stack,
      ednevnikBaseUrl
    });
    return res.status(502).json({
      success: false,
      error: `Ne mogu se povezati s e-Dnevnikom (${error?.message || "nepoznata greska"}).`
    });
  }
}
