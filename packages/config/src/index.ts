import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";
import Store from "electron-store";
import { z } from "zod";

// Define the AppConfig schema
const appConfigSchema = z.object({
  env: z.enum(["production", "development", "test"]).default("development"),
  port: z.string().default("3001"),
  redisUrl: z.string().default("redis://localhost:6379"),
  processLabel: z.string().default("oncall-api"),
  openaiApiKey: z.string(),
  anthropicApiKey: z.string(),
  googleApiKey: z.string().optional(),
  datadog: z.object({
    apiKey: z.string().optional(),
    appKey: z.string().optional(),
    site: z.string().default("datadoghq.com"),
  }),
  grafana: z.object({
    baseUrl: z.string().default("https://logs-prod-021.grafana.net"),
    username: z.string().optional(),
    password: z.string().optional(),
  }),
  encryptionKey: z
    .string()
    .min(64)
    .default(() => crypto.randomBytes(32).toString("hex")),
});

// Define the AppConfig type for use throughout the application
export type AppConfig = z.infer<typeof appConfigSchema>;

// Environment variables schema - separate from AppConfig
const envSchema = z.object({
  NODE_ENV: z.enum(["production", "development", "test"]).default("development"),
  PORT: z.string().default("3001"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  PROCESS_LABEL: z.string().default("oncall-api"),
  OPENAI_API_KEY: z.string(),
  ANTHROPIC_API_KEY: z.string(),
  GOOGLE_API_KEY: z.string().optional(),
  DATADOG_API_KEY: z.string().optional(),
  DATADOG_APP_KEY: z.string().optional(),
  DATADOG_SITE: z.string().default("datadoghq.com"),
  GRAFANA_BASE_URL: z.string().default("https://logs-prod-021.grafana.net"),
  GRAFANA_USERNAME: z.string().optional(),
  GRAFANA_PASSWORD: z.string().optional(),
  ENCRYPTION_KEY: z
    .string()
    .min(64)
    .default(() => crypto.randomBytes(32).toString("hex")),
});

// Create electron store for persistent config

// @ts-ignore - electron-store has issues with its type definitions
const store = new Store<AppConfig>({
  name: "app-config",
  // Schema isn't directly compatible with zod, but we handle validation manually
});

// Global appConfig object
let appConfig: AppConfig;

/**
 * Loads environment variables from .env file
 */
function loadEnvVars(): z.infer<typeof envSchema> {
  // Hardcode path to .env in repo root
  // @ts-expect-error: TS doesn't recognize import.meta.url in this context
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, "../../../.env");

  if (!fs.existsSync(envPath)) {
    throw new Error(`Error: .env file not found at: ${envPath}`);
  }
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    throw new Error(`Error loading .env file: ${result.error.message}`);
  }
  console.info(`Environment variables loaded from: ${envPath}`);

  // Allow skipping validation in development environments
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    console.info("Skipping environment validation");
    return envSchema.partial().parse(process.env) as z.infer<typeof envSchema>;
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

/**
 * Converts environment variables to AppConfig format
 */
function envToAppConfig(env: z.infer<typeof envSchema>): AppConfig {
  return {
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
}

/**
 * Validates the AppConfig object
 */
function validateAppConfig(config: unknown): AppConfig {
  try {
    return appConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join("\n");
      throw new Error(`Config validation error:\n${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Initializes the global appConfig object
 * Priority: 1. electron-store 2. env variables 3. defaults
 * @returns The initialized AppConfig object
 */
export function initAppConfig(): AppConfig {
  // Load environment variables
  const envVars = loadEnvVars();
  const envConfig = envToAppConfig(envVars);

  // Get stored config (if any)
  const storedConfig = store.get() || {};

  // Merge with priority: stored values > env vars > defaults
  // Start with defaults from schema (already in envConfig),
  // then apply env vars, then apply stored values
  const mergedConfig = {
    ...envConfig, // Includes defaults and env vars
    ...storedConfig, // Stored values override env vars and defaults
  };

  // Validate the merged config
  appConfig = validateAppConfig(mergedConfig);

  // We don't save here to avoid overwriting user preferences with defaults

  return appConfig;
}

/**
 * Updates the global appConfig with new values
 * @param updates Partial AppConfig with values to update
 * @returns Updated AppConfig
 */
export function updateAppConfig(updates: Partial<AppConfig>): AppConfig {
  if (!appConfig) {
    throw new Error("AppConfig not initialized. Call initAppConfig() first.");
  }

  // Create updated config
  const updatedConfig = {
    ...appConfig,
    ...updates,
  };

  // Validate the updated config
  const validatedConfig = validateAppConfig(updatedConfig);

  // Update the global config
  appConfig = validatedConfig;

  // Save to electron-store
  store.set(appConfig);

  return appConfig;
}

/**
 * Gets the current appConfig
 */
export function getAppConfig(): AppConfig {
  if (!appConfig) {
    throw new Error("AppConfig not initialized. Call initAppConfig() first.");
  }
  return appConfig;
}

// Initialize the config and make it available for import
export const config = initAppConfig();
