import {} from "@triage/agent";
import { BrowserWindow, ipcMain } from "electron";
import { AppConfig } from "../../src/config.js";
import {
  AgentAssistantMessage,
  AgentChatMessage,
  invokeAgent,
} from "../../src/renderer/types/index.js";

let mainWindow: BrowserWindow | null = null;

/**
 * Set up all IPC handlers related to agent functionality
 * @param window The main browser window for sending updates
 */
export function setupAgentHandlers(window: BrowserWindow): void {
  console.info("Setting up agent handlers...");
  mainWindow = window;

  // Handle agent invocation
  ipcMain.handle(
    "agent:invoke-agent",
    async (
      _event: any,
      query: string,
      chatHistory: AgentChatMessage[],
      options?: { reasonOnly?: boolean }
    ): Promise<AgentAssistantMessage> => {
      try {
        console.info("Invoking agent with query:", query);
        console.info("IPC chat history:", chatHistory);

        // TODO: Don't extract these from env
        const appConfig: AppConfig = {
          repoPath: process.env.REPO_PATH!,
          githubRepoBaseUrl: process.env.GITHUB_REPO_BASE_URL!,
          codebaseOverviewPath: process.env.CODEBASE_OVERVIEW_PATH!,
          observabilityPlatform: process.env.OBSERVABILITY_PLATFORM!,
          observabilityFeatures: process.env.OBSERVABILITY_FEATURES!.split(","),
          // TODO: These should be loaded based on time range extracted from query
          startDate: new Date(process.env.START_DATE!),
          endDate: new Date(process.env.END_DATE!),
        };

        // Get reasonOnly flag from options
        const finalReasonOnly = options?.reasonOnly === true;

        // Send updates to renderer via mainWindow
        const onUpdate = (update: any) => {
          if (mainWindow) {
            mainWindow.webContents.send("agent:agent-update", update);
          }
        };

        const result = await invokeAgent({
          query,
          chatHistory,
          repoPath: appConfig.repoPath,
          codebaseOverviewPath: appConfig.codebaseOverviewPath,
          observabilityPlatform: appConfig.observabilityPlatform,
          observabilityFeatures: appConfig.observabilityFeatures,
          startDate: appConfig.startDate,
          endDate: appConfig.endDate,
          reasonOnly: finalReasonOnly,
          onUpdate: onUpdate,
        });

        return result;
      } catch (error) {
        console.error("Error invoking agent:", error);
        throw error;
      }
    }
  );

  // Get the current agent configuration
  ipcMain.handle("agent:get-app-config", async (): Promise<AppConfig> => {
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

  // Update the agent configuration
  ipcMain.handle(
    "agent:update-app-config",
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

  console.info("All agent handlers registered.");
}

/**
 * Clean up resources used by agent handlers
 */
export function cleanupAgentHandlers(): void {
  mainWindow = null;
  console.info("Agent handlers cleanup complete.");
}
