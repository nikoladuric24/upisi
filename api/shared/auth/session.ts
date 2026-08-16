import { getSessionFromRequest, sendMethodNotAllowed } from "./_auth";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return sendMethodNotAllowed(res, ["GET"]);
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
