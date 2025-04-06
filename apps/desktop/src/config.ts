/**
 * Configuration for the agent
 */
export interface AgentConfig {
  /** Path to the repository to analyze */
  repoPath: string;

  /** Path to the codebase overview file */
  codebaseOverviewPath: string;

  /** Observability platform to use (grafana or datadog) */
  observabilityPlatform: string;

  /** Observability features to enable */
  observabilityFeatures: string[];

  /** Start date for the time range */
  startDate: Date;

  /** End date for the time range */
  endDate: Date;
}

/**
 * Default configuration for the agent
 */
export const defaultConfig: AgentConfig = {
  repoPath: "/Users/luketchang/code/ticketing",
  codebaseOverviewPath: "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md",
  observabilityPlatform: "datadog",
  observabilityFeatures: ["logs"],
  startDate: new Date("2025-04-01T21:00:00Z"),
  endDate: new Date("2025-04-01T22:00:00Z"),
};
