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
export interface AppConfig {
  /** Path to the repository to analyze */
  repoPath: string;

  /** Base URL for the GitHub repository */
  githubRepoBaseUrl: string;

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
