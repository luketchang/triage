import { CodebaseProcessor } from "@triage/codebase-overviews";
import { getModelWrapper } from "@triage/common";
import { BrowserWindow, ipcMain } from "electron";
import fs from "fs/promises";
import { AppConfigStore } from "../../common/AppConfig.js";

/**
 * Set up all IPC handlers related to codebase processing
 */
export function setupCodebaseHandlers(window: BrowserWindow, appCfgStore: AppConfigStore): void {
  console.info("Setting up codebase handlers...");

  // Handle codebase overview generation
  ipcMain.handle(
    "codebase:generate-overview",
    async (_event: any, repoPath: string): Promise<string> => {
      try {
        console.info(`Generating codebase overview for: ${repoPath}`);

        // Validate repo path
        try {
          await fs.access(repoPath);
        } catch (error) {
          throw new Error(`Repository path does not exist or is not accessible: ${repoPath}`);
        }

        const currentConfig = await appCfgStore.getValues();
        const model = currentConfig.balancedModel;
        const llmClient = getModelWrapper(model, {
          openaiApiKey: currentConfig.openaiApiKey,
          anthropicApiKey: currentConfig.anthropicApiKey,
          googleApiKey: currentConfig.googleApiKey,
        });

        // Create processor with progress callback
        const processor = new CodebaseProcessor(
          llmClient,
          repoPath,
          "", // No system description needed
          {
            // Forward progress updates to the renderer process
            onProgress: (update) => {
              console.info(
                `Codebase overview progress: ${update.status} (${update.progress}%) - ${update.message}`
              );
              // Don't send completed update here; only send it after it's been written
              if (update.status !== "completed") {
                window.webContents.send("codebase:overview-progress", update);
              }
            },
          }
        );

        // Generate the overview - now with real-time progress updates
        const codebaseOverview = await processor.process();

        // Update config with the new overview path
        await appCfgStore.setValues({
          codebaseOverview: {
            content: codebaseOverview,
            createdAt: new Date().toISOString(),
            commitHash: undefined,
          },
        });

        window.webContents.send("codebase:overview-progress", {
          status: "completed",
          message: "Codebase overview generated successfully!",
          progress: 100,
        });

        return codebaseOverview;
      } catch (error: unknown) {
        console.error("Error generating codebase overview:", error);

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

  console.info("All codebase handlers registered.");
}

/**
 * Clean up resources used by codebase handlers
 */
export function cleanupCodebaseHandlers(): void {
  ipcMain.removeHandler("codebase:generate-overview");
  console.info("Codebase handlers cleanup complete.");
}
