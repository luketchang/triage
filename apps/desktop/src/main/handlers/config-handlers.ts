import { ipcMain } from "electron";
import { AppConfig, AppConfigStore } from "../../common/AppConfig.js";

/**
 * Set up all IPC handlers related to configuration
 */
export function setupConfigHandlers(appCfgStore: AppConfigStore): void {
  console.info("Setting up config handlers...");

  // Get all config values for the settings UI
  ipcMain.handle("config:get-app-config", async (): Promise<AppConfig> => {
    try {
      console.info("Fetching all config values");
      return appCfgStore.getValues();
    } catch (error) {
      console.error("Error fetching config values:", error);
      throw error;
    }
  });

  // Update all config values
  ipcMain.handle(
    "config:update-app-config",
    async (_event: any, partial: Partial<AppConfig>): Promise<AppConfig> => {
      try {
        console.info("Updating config values");
        await appCfgStore.setValues(partial);
        // Return updated config
        return appCfgStore.getValues();
      } catch (error) {
        console.error("Error updating config:", error);
        throw error;
      }
    }
  );

  console.info("All config handlers registered.");
}

/**
 * Clean up resources used by config handlers
 */
export function cleanupConfigHandlers(): void {
  ipcMain.removeHandler("config:get-app-config");
  ipcMain.removeHandler("config:update-app-config");
  console.info("Config handlers cleanup complete.");
}
