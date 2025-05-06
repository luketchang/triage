import crypto from "crypto";
import fs from "fs";
import path from "path";

import { config } from "dotenv";
import { z } from "zod";

// Look for .env in the repo root (three directories up from packages/config)
const repoRoot = path.resolve(__dirname, "../../../");
const envPath = path.join(repoRoot, ".env");
console.info(`Loading .env file from: ${envPath}`);
console.info(`Current working directory: ${process.cwd()}`);
console.info(`.env file exists: ${fs.existsSync(envPath)}`);

const result = config({ path: envPath });
console.info(`Environment variables after loading:`, {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "Set" : "Not set",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "Set" : "Not set",
});

const envSchema = z.object({
  NODE_ENV: z.enum(["production", "development", "test"]).default("development"),
  PORT: z.string().default("3001"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  PROCESS_LABEL: z.string().default("oncall-api"),
  // Make these optional in development mode
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),

  // Datadog variables (optional by default)
  DATADOG_API_KEY: z.string().optional(),
  DATADOG_APP_KEY: z.string().optional(),
  DATADOG_SITE: z.string().default("datadoghq.com"),

  // Grafana variables (optional by default)
  GRAFANA_BASE_URL: z.string().default("https://logs-prod-021.grafana.net"),
  GRAFANA_USERNAME: z.string().optional(),
  GRAFANA_PASSWORD: z.string().optional(),

  // Encryption key for DB secrets
  ENCRYPTION_KEY: z
    .string()
    .min(64)
    .default(() => crypto.randomBytes(32).toString("hex")),
});

// Define the return type
type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
  // Allow skipping validation in development environments
  if (process.env.SKIP_ENV_VALIDATION === "true" || process.env.NODE_ENV === "development") {
    console.info("Skipping environment validation in development mode");
    return envSchema.partial().parse(process.env) as EnvConfig;
  }

  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join("\n");
      throw new Error(`Environment validation error:\n${errorMessages}`);
    }
    throw error;
  }
}

const env = validateEnv();

const configObject = {
  env: env.NODE_ENV,
  port: env.PORT,
  redisUrl: env.REDIS_URL,
  processLabel: env.PROCESS_LABEL,
  openaiApiKey: env.OPENAI_API_KEY,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  googleApiKey: env.GOOGLE_API_KEY,
  datadog: {
    apiKey: env.DATADOG_API_KEY,
    appKey: env.DATADOG_APP_KEY,
    site: env.DATADOG_SITE,
  },
  grafana: {
    baseUrl: env.GRAFANA_BASE_URL,
    username: env.GRAFANA_USERNAME,
    password: env.GRAFANA_PASSWORD,
  },
  encryptionKey: env.ENCRYPTION_KEY,
};

export { configObject as config };
