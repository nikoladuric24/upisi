import { getSessionFromRequest, sendMethodNotAllowed } from "./_auth";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return sendMethodNotAllowed(res, ["POST"]);
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: "Nema aktivne sesije." });
  }

  return res.status(200).json({ success: true });
}
