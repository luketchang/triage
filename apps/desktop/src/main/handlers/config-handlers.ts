import { ipcMain } from "electron";
import { AppConfig } from "../../renderer/src/config.js";

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

      // Return the updated configuration
      return {
        repoPath: process.env.REPO_PATH || "/Users/luketchang/code/ticketing",
        githubRepoBaseUrl:
          process.env.GITHUB_REPO_BASE_URL || "https://github.com/luketchang/ticketing",
        codebaseOverviewPath:
          process.env.CODEBASE_OVERVIEW_PATH ||
          "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md",
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
