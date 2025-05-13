import { exec } from "child_process";
import { ipcMain } from "electron";
import fs from "fs";
import { promisify } from "util";
import { AppConfig, AppConfigStore } from "../../common/AppConfig.js";

const execPromise = promisify(exec);

/**
 * Check if a directory exists
 */
async function directoryExists(path: string): Promise<boolean> {
  try {
    return fs.existsSync(path);
  } catch (error) {
    console.error(`Error checking if directory exists: ${path}`, error);
    return false;
  }
}

/**
 * Get the GitHub remote URL for a repository
 */
async function getGithubRemoteUrl(repoPath: string): Promise<string | null> {
  try {
    const { stdout } = await execPromise(`cd "${repoPath}" && git remote get-url origin`);
    const gitRemoteUrl = stdout.trim();

    // Convert SSH URL to HTTPS URL if needed
    let githubUrl = gitRemoteUrl;
    if (githubUrl.startsWith("git@github.com:")) {
      // Convert SSH URL format (git@github.com:user/repo.git) to HTTPS format
      githubUrl = githubUrl.replace(/^git@github\.com:/, "https://github.com/");
    }

    // Remove .git suffix if present
    if (githubUrl.endsWith(".git")) {
      githubUrl = githubUrl.slice(0, -4);
    }

    return githubUrl;
  } catch (error) {
    console.warn(`Failed to infer GitHub repo URL: ${error}`);
    return null;
  }
}

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

        // Get current configuration to check for changes
        const currentConfig = await appCfgStore.getValues();

        // If repoPath changed, handle special logic
        if (partial.repoPath && partial.repoPath !== currentConfig.repoPath) {
          console.info(`Repository path changed to: ${partial.repoPath}`);

          // Check if the path exists
          if (!(await directoryExists(partial.repoPath))) {
            throw new Error(`Repository path does not exist: ${partial.repoPath}`);
          }

          // Clear dependent fields
          partial.codebaseOverview = undefined;
          partial.githubRepoBaseUrl = undefined;

          // Try to infer GitHub repo URL from git remote
          const githubUrl = await getGithubRemoteUrl(partial.repoPath);
          if (githubUrl) {
            partial.githubRepoBaseUrl = githubUrl;
            console.info(`Inferred GitHub repo URL: ${githubUrl}`);
          }
        }

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
