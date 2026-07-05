import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(backendRoot, ".env") });

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    return fallback ?? "";
  }

  return value.trim();
}

export const env = {
  NODE_ENV: getEnv("NODE_ENV", "development"),
  PORT: Number(getEnv("PORT", "8000")),
  MONGODB_URI: getEnv("MONGODB_URI", "mongodb://127.0.0.1:27017/auth-backend"),
  CLIENT_URL: getEnv("CLIENT_URL", "http://localhost:5173"),
  JWT_SECRET: getEnv("JWT_SECRET", "supersecretjwtkey"),
  JWT_EXPIRES_IN: getEnv("JWT_EXPIRES_IN", "7d"),
  SARVAM_API_KEY: getEnv("SARVAM_API_KEY"),
  SARVAM_BASE_URL: getEnv("SARVAM_BASE_URL", "https://api.sarvam.ai"),
  GROK_API_KEY: getEnv("GROK_API_KEY"),
  GROK_BASE_URL: getEnv("GROK_BASE_URL", "https://api.x.ai/v1"),
  OLLAMA_BASE_URL: getEnv("OLLAMA_BASE_URL", "http://localhost:11434"),
} as const;
