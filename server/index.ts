import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { registerRoutes } from "./routes";

const app = express();
const __dirname = path.resolve();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "1aShirt API is running" });
});

const port = Number(process.env.PORT || 3000);

registerRoutes(app).then((httpServer) => {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, "dist/public")));
  
  // SPA fallback: serve index.html for all non-API routes
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(__dirname, "dist/public/index.html"));
    } else {
      res.status(404).json({ error: "API endpoint not found" });
    }
  });
  
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`✓ API server listening on http://0.0.0.0:${port}`);
  });
});
