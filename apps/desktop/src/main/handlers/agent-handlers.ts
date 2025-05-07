import {} from "@triage/agent";
import { BrowserWindow, ipcMain } from "electron";
import { AppConfig } from "../../renderer/src/config.js";
import {
  AgentAssistantMessage,
  AgentChatMessage,
  invokeAgent,
} from "../../renderer/src/types/index.js";

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

  console.info("All agent handlers registered.");
}

/**
 * Clean up resources used by agent handlers
 */
export function cleanupAgentHandlers(): void {
  mainWindow = null;
  console.info("Agent handlers cleanup complete.");
}
