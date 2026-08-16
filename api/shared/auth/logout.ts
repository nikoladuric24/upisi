import { createApp } from "../../../server";

const appPromise = createApp();

export default async function handler(req: any, res: any) {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (error: any) {
    console.error("[UPISI_API] Logout failed:", {
      message: error?.message,
      stack: error?.stack
    });
    return res.status(500).json({
      success: false,
      error: "Odjavu trenutno nije moguce obraditi."
    });
  }
}
