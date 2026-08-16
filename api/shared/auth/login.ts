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
  return raw.includes("@") ? raw : `${raw}@skolehr.xyz`;
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
  if (portalType === "FACULTY_ADMISSIONS" && normalized.some((role) => ["UNIVERSITY_ADMIN", "FACULTY_ADMIN"].includes(role))) return "UNIVERSITY_ADMIN";
  if (normalized.some((role) => ["ADMIN", "SCHOOL_ADMIN"].includes(role))) {
    return portalType === "FACULTY_ADMISSIONS" ? "SECONDARY_ADMIN" : "PRIMARY_ADMIN";
  }
  if (normalized.some((role) => ["HOMEROOM", "HOMEROOM_TEACHER", "DEPUTY", "TEACHER", "STAFF"].includes(role))) {
    return portalType === "FACULTY_ADMISSIONS" ? "SECONDARY_HOMEROOM_TEACHER" : "PRIMARY_HOMEROOM_TEACHER";
  }
  return portalType === "FACULTY_ADMISSIONS" ? "SECONDARY_STUDENT" : "PRIMARY_STUDENT";
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
  const totpCode = req.body?.totpCode || req.body?.authenticatorCode || req.body?.code;
  const loginType = req.body?.loginType || "STAFF";
  const ednevnikBaseUrl = (process.env.EDNEVNIK_AUTH_BASE_URL || process.env.EDNEVNIK_BASE_URL || "").replace(/\/$/, "");

  console.log("[UPISI_LOGIN] request", {
    host,
    portalType,
    normalizedEmail,
    hasPassword: Boolean(password),
    hasTotpCode: Boolean(totpCode),
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
    const upstreamResponse = await fetch(`${ednevnikBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        username: normalizedEmail,
        password,
        pin: password,
        loginType,
        totpCode
      })
    });

    const raw = await upstreamResponse.text();
    let result: any = null;
    if (raw) {
      try {
        result = JSON.parse(raw);
      } catch {
        result = { raw };
      }
    }

    console.log("[UPISI_LOGIN] ednevnik result", {
      status: upstreamResponse.status,
      ok: upstreamResponse.ok,
      hasUser: Boolean(result?.user),
      hasProfile: Boolean(result?.profile),
      roles: result?.roles
    });

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
