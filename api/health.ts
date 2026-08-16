export default function handler(_req: any, res: any) {
  return res.status(200).json({
    success: true,
    service: "upisi",
    timestamp: new Date().toISOString()
  });
}
