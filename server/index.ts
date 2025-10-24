import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "1aShirt API is running" });
});

const port = Number(process.env.PORT || 3000);

registerRoutes(app).then((httpServer) => {
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`✓ API server listening on http://0.0.0.0:${port}`);
  });
});
