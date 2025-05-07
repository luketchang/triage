import { appConfig, AppConfig } from "@triage/config";
import { ipcMain } from "electron";

/**
 * Set up all IPC handlers related to configuration
 */
export function setupConfigHandlers(): void {
  console.info("Setting up config handlers...");

  // Get the current application configuration
  ipcMain.handle("config:get-app-config", async (): Promise<AppConfig> => {
    return appConfig;
  });

  // Update the application configuration
  ipcMain.handle(
    "config:update-app-config",
    async (_event: any, newConfig: Partial<AppConfig>): Promise<AppConfig> => {
      // Store updated values in process.env for future access
      if (newConfig.repoPath) {
        appConfig.repoPath = newConfig.repoPath;
      }
      if (newConfig.codebaseOverviewPath) {
        appConfig.codebaseOverviewPath = newConfig.codebaseOverviewPath;
      }

      // Return the updated configuration
      return appConfig;
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
