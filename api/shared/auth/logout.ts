import { clearSessionCookie, sendMethodNotAllowed } from "./_auth.ts";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return sendMethodNotAllowed(res, ["POST"]);
  }

  clearSessionCookie(res);
  return res.status(200).json({ success: true });
}
