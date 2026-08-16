import { createApp } from "../server";

const appPromise = createApp();

export default async function handler(req: any, res: any) {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (error: any) {
    console.error("[UPISI_API] Failed:", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({
      success: false,
      error: "Zahtjev trenutno nije moguce obraditi."
    });
  }
}
