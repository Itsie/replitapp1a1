import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, log } from "./vite";
import { sessionConfig } from "./session";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(session(sessionConfig));

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "1aShirt API is running" });
});

const port = Number(process.env.PORT || 5000);

registerRoutes(app).then(async (httpServer) => {
  // In development, use Vite dev server
  // In production, serve static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, httpServer);
  } else {
    // Production: serve static files
    const path = await import("path");
    const __dirname = path.resolve();
    app.use(express.static(path.join(__dirname, "dist/public")));
    
    app.get("*", (req, res) => {
      if (!req.path.startsWith("/api")) {
        res.sendFile(path.join(__dirname, "dist/public/index.html"));
      } else {
        res.status(404).json({ error: "API endpoint not found" });
      }
    });
  }
  
  httpServer.listen(port, "0.0.0.0", () => {
    log(`API server listening on http://0.0.0.0:${port}`);
  });
});
