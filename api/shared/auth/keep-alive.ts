export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method Not Allowed", allowed: ["POST"] });
  }

  return res.status(200).json({ success: true });
}
