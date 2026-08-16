import crypto from "crypto";

type PortalType = "FACULTY_ADMISSIONS" | "SECONDARY_ADMISSIONS";

interface PortalSessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

interface PortalSession {
  user: PortalSessionUser;
  roles: string[];
  portalType: PortalType;
  source: string;
  createdAt: string;
  expiresAt: string;
}

const COOKIE_NAME = "eduportal_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.EMATICA_SERVICE_SECRET || "upisi-local-session-secret";
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function normalizeEmail(value: string): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.includes("@") ? raw : `${raw}@skolehr.xyz`;
}

export function resolvePortalFromHost(hostname: string): PortalType {
  const cleanHost = hostname.toLowerCase().split(":")[0].replace(/\.$/, "");

  if (cleanHost === "postani-student.skolehr.xyz" || cleanHost === "fakulteti.skolehr.xyz") {
    return "FACULTY_ADMISSIONS";
  }

  return "SECONDARY_ADMISSIONS";
}

export function mapEdnevnikRolesToPortalRole(roles: string[], portalType: PortalType): string {
  const normalized = roles.map((role) => String(role || "").toUpperCase());

  if (normalized.some((role) => ["SUPER_ADMIN", "MAIN_ADMIN"].includes(role))) {
    return "SUPER_ADMIN";
  }

  if (portalType === "FACULTY_ADMISSIONS" && normalized.some((role) => ["UNIVERSITY_ADMIN", "FACULTY_ADMIN"].includes(role))) {
    return "UNIVERSITY_ADMIN";
  }

  if (normalized.some((role) => ["ADMIN", "SCHOOL_ADMIN"].includes(role))) {
    return portalType === "FACULTY_ADMISSIONS" ? "SECONDARY_ADMIN" : "PRIMARY_ADMIN";
  }

  if (normalized.some((role) => ["HOMEROOM", "HOMEROOM_TEACHER", "DEPUTY", "TEACHER", "STAFF"].includes(role))) {
    return portalType === "FACULTY_ADMISSIONS" ? "SECONDARY_HOMEROOM_TEACHER" : "PRIMARY_HOMEROOM_TEACHER";
  }

  return portalType === "FACULTY_ADMISSIONS" ? "SECONDARY_STUDENT" : "PRIMARY_STUDENT";
}

export function createSignedSession(user: PortalSessionUser, roles: string[], portalType: PortalType, source = "ednevnik"): string {
  const now = Date.now();
  const session: PortalSession = {
    user,
    roles,
    portalType,
    source,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_MAX_AGE_SECONDS * 1000).toISOString()
  };

  const payload = base64Url(JSON.stringify(session));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function parseSignedSession(token: string | undefined | null): PortalSession | null {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || signPayload(payload) !== signature) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PortalSession;
    if (!session?.expiresAt || new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: any): PortalSession | null {
  const cookieHeader = String(req.headers?.cookie || "");
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);

  return parseSignedSession(token ? decodeURIComponent(token) : "");
}

export function setSessionCookie(res: any, token: string): void {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`
  );
}

export function clearSessionCookie(res: any): void {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function sendMethodNotAllowed(res: any, allowed: string[]): void {
  res.setHeader("Allow", allowed.join(", "));
  res.status(405).json({ success: false, error: "Method Not Allowed", allowed });
}
