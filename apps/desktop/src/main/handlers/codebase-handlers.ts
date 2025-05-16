import { CodebaseOverview, CodebaseProcessor } from "@triage/codebase-overviews";
import { getModelWrapper, logger } from "@triage/common";
import { BrowserWindow, ipcMain } from "electron";
import { AppConfigStore } from "../../common/AppConfig.js";
import { registerHandler } from "./register-util.js";

/**
 * Set up all IPC handlers related to codebase processing
 */
export function setupCodebaseHandlers(window: BrowserWindow, appCfgStore: AppConfigStore): void {
  logger.info("Setting up codebase handlers...");

  // Handle codebase overview generation
  registerHandler(
    "codebase:generate-overview",
    async (_event: any, repoPath: string): Promise<CodebaseOverview> => {
      try {
        logger.info(`Generating codebase overview for: ${repoPath}`);

        const currentConfig = await appCfgStore.getValues();
        const model = currentConfig.balancedModel;
        const llmClient = getModelWrapper(model, {
          openaiApiKey: currentConfig.openaiApiKey,
          anthropicApiKey: currentConfig.anthropicApiKey,
          googleApiKey: currentConfig.googleApiKey,
        });

        // Generate the overview with real-time progress updates
        const processor = new CodebaseProcessor(repoPath, llmClient, {
          // Forward progress updates to the renderer process
          onProgress: (update) => {
            logger.info(
              `Codebase overview progress: ${update.status} (${update.progress}%) - ${update.message}`
            );
            window.webContents.send("codebase:overview-progress", update);
          },
        });
        const codebaseOverview = await processor.process();

        // Update the config with the new overview
        await appCfgStore.setValues({
          codebaseOverview: {
            content: codebaseOverview.content,
            repoPath: codebaseOverview.repoPath,
            createdAt: codebaseOverview.createdAt.toISOString(),
            commitHash: codebaseOverview.commitHash,
          },
        });

        return codebaseOverview;
      } catch (error: unknown) {
        logger.error("Error generating codebase overview:", error);

        // Send error to renderer
        window.webContents.send("codebase:overview-progress", {
          status: "error",
          message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          progress: 0,
        });

        throw error;
      }
    }
  );

  window.on("close", () => {
    ipcMain.removeAllListeners("codebase:generate-overview");
  });

  logger.info("All codebase handlers registered.");
}

/**
 * Clean up resources used by codebase handlers
 */
export function cleanupCodebaseHandlers(): void {
  ipcMain.removeHandler("codebase:generate-overview");
  logger.info("Codebase handlers cleanup complete.");
}
