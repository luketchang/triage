import { ipcMain } from "electron";
import { AppConfig } from "../../src/renderer/src/config.js";

/**
 * Set up all IPC handlers related to configuration
 */
export function setupConfigHandlers(): void {
  console.info("Setting up config handlers...");

  // Get the current application configuration
  ipcMain.handle("config:get-app-config", async (): Promise<AppConfig> => {
    return {
      repoPath: process.env.REPO_PATH || "/Users/luketchang/code/ticketing",
      githubRepoBaseUrl:
        process.env.GITHUB_REPO_BASE_URL || "https://github.com/luketchang/ticketing",
      codebaseOverviewPath:
        process.env.CODEBASE_OVERVIEW_PATH ||
        "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md",
      observabilityPlatform: process.env.OBSERVABILITY_PLATFORM || "datadog",
      observabilityFeatures: process.env.OBSERVABILITY_FEATURES
        ? process.env.OBSERVABILITY_FEATURES.split(",")
        : ["logs"],
      startDate: new Date(process.env.START_DATE || "2025-04-16T21:00:00Z"),
      endDate: new Date(process.env.END_DATE || "2025-04-16T23:59:59Z"),
    };
  });

  // Update the application configuration
  ipcMain.handle(
    "config:update-app-config",
    async (_event: any, newConfig: Partial<AppConfig>): Promise<AppConfig> => {
      // Store updated values in process.env for future access
      if (newConfig.repoPath) {
        process.env.REPO_PATH = newConfig.repoPath;
      }
      if (newConfig.codebaseOverviewPath) {
        process.env.CODEBASE_OVERVIEW_PATH = newConfig.codebaseOverviewPath;
      }
      if (newConfig.observabilityPlatform) {
        process.env.OBSERVABILITY_PLATFORM = newConfig.observabilityPlatform;
      }
      if (newConfig.observabilityFeatures) {
        process.env.OBSERVABILITY_FEATURES = newConfig.observabilityFeatures.join(",");
      }
      if (newConfig.startDate) {
        process.env.START_DATE = newConfig.startDate.toISOString();
      }
      if (newConfig.endDate) {
        process.env.END_DATE = newConfig.endDate.toISOString();
      }

      // Return the updated configuration
      return {
        repoPath: process.env.REPO_PATH || "/Users/luketchang/code/ticketing",
        githubRepoBaseUrl:
          process.env.GITHUB_REPO_BASE_URL || "https://github.com/luketchang/ticketing",
        codebaseOverviewPath:
          process.env.CODEBASE_OVERVIEW_PATH ||
          "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md",
        observabilityPlatform: process.env.OBSERVABILITY_PLATFORM || "datadog",
        observabilityFeatures: process.env.OBSERVABILITY_FEATURES
          ? process.env.OBSERVABILITY_FEATURES.split(",")
          : ["logs"],
        startDate: new Date(process.env.START_DATE || "2025-04-16T21:00:00Z"),
        endDate: new Date(process.env.END_DATE || "2025-04-16T23:59:59Z"),
      };
    }
  );

  console.info("All config handlers registered.");
}

/**
 * Clean up resources used by config handlers
 */
export function cleanupConfigHandlers(): void {
  console.info("Config handlers cleanup complete.");
}
