import {
  createSignedSession,
  mapEdnevnikRolesToPortalRole,
  normalizeEmail,
  resolvePortalFromHost,
  sendMethodNotAllowed,
  setSessionCookie
} from "./_auth.ts";

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return sendMethodNotAllowed(res, ["POST"]);
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
