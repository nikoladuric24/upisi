import { createHmac } from "node:crypto";

const COOKIE_NAME = "eduportal_session";

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.EMATICA_SERVICE_SECRET || "upisi-local-session-secret";
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function getSessionFromRequest(req: any): any | null {
  const cookieHeader = String(req.headers?.cookie || "");
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);

  if (!token) return null;
  const [payload, signature] = decodeURIComponent(token).split(".");
  if (!payload || !signature || signPayload(payload) !== signature) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session?.expiresAt || new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method Not Allowed", allowed: ["GET"] });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: "Nema aktivne sesije." });
  }

  return res.status(200).json({
    success: true,
    user: session.user,
    roles: session.roles,
    portalType: session.portalType,
    source: session.source
  });
}
