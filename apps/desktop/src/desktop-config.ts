import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
const projectRoot = path.resolve(__dirname, "../../../");
dotenv.config({ path: path.join(projectRoot, ".env") });

// Define desktop-specific configuration with fallbacks
export const desktopConfig = {
  // App configuration
  env: process.env.NODE_ENV || "development",

  // LLM API Keys with fallbacks for development
  openaiApiKey:
    process.env.OPENAI_API_KEY ||
    (process.env.NODE_ENV === "development" ? "sk-dev-mode-openai" : undefined),
  anthropicApiKey:
    process.env.ANTHROPIC_API_KEY ||
    (process.env.NODE_ENV === "development" ? "sk-dev-mode-anthropic" : undefined),

  // Agent configuration
  agent: {
    repoPath: process.env.REPO_PATH || "/Users/luketchang/code/ticketing",
    codebaseOverviewPath:
      process.env.CODEBASE_OVERVIEW_PATH ||
      "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md",
    observabilityPlatform: process.env.OBSERVABILITY_PLATFORM || "datadog",
    observabilityFeatures: (process.env.OBSERVABILITY_FEATURES || "logs").split(","),
    startDate: new Date(process.env.START_DATE || "2025-04-01T21:00:00Z"),
    endDate: new Date(process.env.END_DATE || "2025-04-01T22:00:00Z"),
  },

  // Datadog configuration
  datadog: {
    apiKey: process.env.DATADOG_API_KEY,
    appKey: process.env.DATADOG_APP_KEY,
    site: process.env.DATADOG_SITE || "datadoghq.com",
  },

  // Grafana configuration
  grafana: {
    baseUrl: process.env.GRAFANA_BASE_URL || "https://logs-prod-021.grafana.net",
    username: process.env.GRAFANA_USERNAME,
    password: process.env.GRAFANA_PASSWORD,
  },
};

// Function to check if we have valid API keys
export function hasValidApiKeys(): boolean {
  return Boolean(
    desktopConfig.openaiApiKey &&
      desktopConfig.anthropicApiKey &&
      // Check if they're not the development fallbacks
      !(
        desktopConfig.openaiApiKey === "sk-dev-mode-openai" && process.env.NODE_ENV === "production"
      ) &&
      !(
        desktopConfig.anthropicApiKey === "sk-dev-mode-anthropic" &&
        process.env.NODE_ENV === "production"
      )
  );
}

// Log the configuration (with redacted keys) for debugging
const redactApiKey = (key?: string) =>
  key ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : "Not set";

console.log("Desktop configuration loaded:", {
  env: desktopConfig.env,
  openaiApiKey: redactApiKey(desktopConfig.openaiApiKey),
  anthropicApiKey: redactApiKey(desktopConfig.anthropicApiKey),
  // Don't log the entire config for security
});

export default desktopConfig;
