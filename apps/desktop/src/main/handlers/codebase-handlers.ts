import { CodebaseProcessor } from "@triage/codebase-overviews";
import { GeminiModel, getModelWrapper } from "@triage/common";
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
        // Validate repo path
        try {
          await fs.access(repoPath);
        } catch (error) {
          throw new Error(`Repository path does not exist or is not accessible: ${repoPath}`);
        }

        console.info(`Generating codebase overview for: ${repoPath}`);

        // Send initial progress update to renderer
        window.webContents.send("codebase:overview-progress", {
          status: "started",
          message: "Starting codebase analysis...",
          progress: 0,
        });

        // Get current configuration to access API keys
        const currentConfig = await appCfgStore.getValues();

        // Create LLM client - use the reasoningModel if available, otherwise fallback to Gemini
        const model = currentConfig.reasoningModel || GeminiModel.GEMINI_2_5_PRO;

        const llmClient = getModelWrapper(model, {
          openaiApiKey: currentConfig.openaiApiKey,
          anthropicApiKey: currentConfig.anthropicApiKey,
          googleApiKey: currentConfig.googleApiKey,
        });

        // Create processor with optimized chunk size
        const processor = new CodebaseProcessor(
          llmClient,
          repoPath,
          "" // No system description needed
        );

        // Generate the overview - unfortunately we can't get progress updates
        // from the processor, so we'll just send a few staged updates
        window.webContents.send("codebase:overview-progress", {
          status: "processing",
          message: "Analyzing repository structure...",
          progress: 10,
        });

        setTimeout(() => {
          window.webContents.send("codebase:overview-progress", {
            status: "processing",
            message: "Collecting and analyzing files...",
            progress: 30,
          });
        }, 1000);

        setTimeout(() => {
          window.webContents.send("codebase:overview-progress", {
            status: "processing",
            message: "Processing directory structures...",
            progress: 50,
          });
        }, 3000);

        setTimeout(() => {
          window.webContents.send("codebase:overview-progress", {
            status: "processing",
            message: "Generating directory summaries...",
            progress: 70,
          });
        }, 8000);

        // Generate the overview
        const codebaseOverview = await processor.process();

        // Update config with the new overview path
        await appCfgStore.setValues({
          codebaseOverview: {
            content: codebaseOverview,
            createdAt: new Date(),
            commitHash: "TODO",
          },
        });

        // Send final progress update
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
