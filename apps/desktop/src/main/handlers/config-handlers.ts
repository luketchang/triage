import { logger } from "@triage/common";
import { getGitRemoteUrl } from "@triage/common";
import { ipcMain } from "electron";
import fs from "fs/promises";
import { AppConfig, AppConfigStore } from "../../common/AppConfig.js";
import { registerHandler } from "./register-util.js";

/**
 * Set up all IPC handlers related to configuration
 */
export function setupConfigHandlers(appCfgStore: AppConfigStore): void {
  logger.info("Setting up config handlers...");

  // Get all config values for the settings UI
  registerHandler("config:get-app-config", async (): Promise<AppConfig> => {
    try {
      return appCfgStore.getValues();
    } catch (error) {
      logger.error("Error fetching config values:", error);
      throw error;
    }
  });

  // Update all config values
  registerHandler(
    "config:update-app-config",
    async (_event: any, partial: Partial<AppConfig>): Promise<AppConfig> => {
      try {
        logger.info("Updating config values");

        // Get current configuration to check for changes
        const currentConfig = await appCfgStore.getValues();

        // If repoPath changed, handle special logic
        if (partial.repoPath && partial.repoPath !== currentConfig.repoPath) {
          logger.info(`Repository path changed to: ${partial.repoPath}`);

          // Check if the path exists
          try {
            await fs.access(partial.repoPath);
          } catch (error) {
            throw new Error(`Repository path does not exist: ${partial.repoPath}`);
          }

          // Try to infer GitHub repo URL from git remote
          try {
            const githubUrl = await getGitRemoteUrl(partial.repoPath);
            logger.info(`Inferred GitHub repo URL: ${githubUrl}`);
            partial.githubRepoBaseUrl = githubUrl;
          } catch (error) {
            logger.warn(`Error inferring GitHub repo URL: ${error}`);
            partial.githubRepoBaseUrl = undefined;
          }
        }

        await appCfgStore.setValues(partial);
        // Return updated config
        return appCfgStore.getValues();
      } catch (error) {
        logger.error("Error updating config:", error);
        throw error;
      }
    }
  );

  logger.info("All config handlers registered.");
}

/**
 * Clean up resources used by config handlers
 */
export function cleanupConfigHandlers(): void {
  ipcMain.removeHandler("config:get-app-config");
  ipcMain.removeHandler("config:update-app-config");
  logger.info("Config handlers cleanup complete.");
}
