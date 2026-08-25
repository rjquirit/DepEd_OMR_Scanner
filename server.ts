import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { processOMRImageWithCV } from "./src/utils/serverOmrCv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing large JSON payloads (high-res base64 images)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    engine: "OMR_CV_C++_SHARP_V4",
    timestamp: new Date().toISOString(),
  });
});

// OMR Scanning API endpoint — Pure Computer Vision (No AI required)
app.post("/api/scan-omr", async (req, res) => {
  const startTime = Date.now();
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing required imageBase64 payload" });
    }

    // Clean base64 data prefix if present (e.g. data:image/png;base64,...)
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
    const imageBuffer = Buffer.from(cleanBase64, "base64");

    // Execute high-speed native Computer Vision OMR pipeline
    const cvResult = await processOMRImageWithCV(imageBuffer);

    return res.json({
      ...cvResult,
      engine: "OPENCV_C++_SHARP_CV_V4",
      processing_time_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error("OMR Scanning Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to process OMR answer sheet via Computer Vision",
      details: error.toString(),
      processing_time_ms: Date.now() - startTime,
    });
  }
});

// Vite / static file serving middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OMR Scanner server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
