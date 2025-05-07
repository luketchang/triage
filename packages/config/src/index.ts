export interface AppConfig {
  env: string;

  openaiApiKey: string;
  anthropicApiKey: string;
  googleApiKey?: string;
  datadog?: DatadogConfig;
  grafana?: GrafanaConfig;

  /** Path to the repository to analyze */
  repoPath: string;
  /** Base URL for the GitHub repository */
  githubRepoBaseUrl: string;
  /** Path to the codebase overview file */
  codebaseOverviewPath: string;
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

// TODO: remove temporary defaults
const appConfig: AppConfig = {
  env: process.env.NODE_ENV || "development",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  googleApiKey: process.env.GOOGLE_API_KEY || "",
  datadog: {
    apiKey: process.env.DATADOG_API_KEY || "",
    appKey: process.env.DATADOG_APP_KEY || "",
    site: process.env.DATADOG_SITE || "",
  },
  grafana: {
    baseUrl: process.env.GRAFANA_BASE_URL || "",
    username: process.env.GRAFANA_USERNAME || "",
    password: process.env.GRAFANA_PASSWORD || "",
  },
  repoPath: process.env.REPO_PATH || "",
  githubRepoBaseUrl: process.env.GITHUB_REPO_BASE_URL || "",
  codebaseOverviewPath: process.env.CODEBASE_OVERVIEW_PATH || "",
};

// Log the configuration to verify it's correctly loaded
console.info("Using environment configuration:", {
  NODE_ENV: appConfig.env,
  openaiApiKey: appConfig.openaiApiKey ? "Set" : "Not set",
  anthropicApiKey: appConfig.anthropicApiKey ? "Set" : "Not set",
  datadog: appConfig.datadog ? "Set" : "Not set",
  grafana: appConfig.grafana ? "Set" : "Not set",
});

export { appConfig };
