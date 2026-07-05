import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

const app: Express = express();

const allowedOrigins = new Set([
  env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, origin ?? env.CLIENT_URL);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);

if (env.NODE_ENV === "production") {
  const possibleDistPaths = [
    path.resolve(process.cwd(), "..", "Debosmita-project", "dist"),
    path.resolve(process.cwd(), "Debosmita-project", "dist"),
    path.resolve(process.cwd(), "..", "..", "Debosmita-project", "dist"),
  ];

  const frontendDistPath = possibleDistPaths.find((candidate) => existsSync(candidate));

  if (frontendDistPath) {
    app.use(express.static(frontendDistPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDistPath, "index.html"));
    });
  }
}

app.use(errorHandler);

export default app;
