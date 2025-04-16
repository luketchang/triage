/**
 * Desktop app-specific configuration
 *
 * This module provides desktop-specific configuration options and defaults.
 * Environment variables are loaded by env-loader.ts before any imports.
 */

/**
 * Desktop app-specific configuration types
 */

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
  repoPath: process.env.REPO_PATH || "/Users/luketchang/code/ticketing",
  codebaseOverviewPath:
    process.env.CODEBASE_OVERVIEW_PATH ||
    "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md",
  observabilityPlatform: process.env.OBSERVABILITY_PLATFORM || "datadog",
  observabilityFeatures: process.env.OBSERVABILITY_FEATURES
    ? process.env.OBSERVABILITY_FEATURES.split(",")
    : ["logs"],
  startDate: new Date(process.env.START_DATE || "2025-04-16T22:00:00Z"),
  endDate: new Date(process.env.END_DATE || "2025-04-16T23:59:59Z"),
};
