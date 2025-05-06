import { z } from "zod";

export interface AppConfig {
  /** Path to the repository to analyze */
  repoPath: string;

  /** Base URL for the GitHub repository */
  githubRepoBaseUrl: string;

  /** Path to the codebase overview file */
  codebaseOverviewPath: string;

  datadogConfig?: DatadogConfig;

  grafanaConfig?: GrafanaConfig;
}

interface DatadogConfig {
  apiKey: string;
  appKey: string;
  site: string;
}

interface GrafanaConfig {
  baseUrl: string;
  username: string;
  password: string;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["production", "development", "test"]).default("development"),
  OPENAI_API_KEY: z.string(),
  ANTHROPIC_API_KEY: z.string(),
  GOOGLE_API_KEY: z.string().optional(),

  // Datadog variables (optional by default)
  DATADOG_API_KEY: z.string().optional(),
  DATADOG_APP_KEY: z.string().optional(),
  DATADOG_SITE: z.string().default("datadoghq.com"),

  // Grafana variables (optional by default)
  GRAFANA_BASE_URL: z.string().default("https://logs-prod-021.grafana.net"),
  GRAFANA_USERNAME: z.string().optional(),
  GRAFANA_PASSWORD: z.string().optional(),
});

// Define the return type
type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
  // Allow skipping validation in development environments
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    console.info("Skipping environment validation");
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

const config = {
  env: env.NODE_ENV,
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
};

// Log the configuration to verify it's correctly loaded
console.info("Using environment configuration:", {
  NODE_ENV: config.env,
  openaiApiKey: config.openaiApiKey ? "Set" : "Not set",
  anthropicApiKey: config.anthropicApiKey ? "Set" : "Not set",
  datadog: {
    apiKey: config.datadog.apiKey ? "Set" : "Not set",
    appKey: config.datadog.appKey ? "Set" : "Not set",
  },
  grafana: {
    baseUrl: config.grafana.baseUrl,
    username: config.grafana.username ? "Set" : "Not set",
  },
});

export { config };
