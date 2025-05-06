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

        const appConfig: AppConfig = {
          repoPath: process.env.REPO_PATH!,
          githubRepoBaseUrl: process.env.GITHUB_REPO_BASE_URL!,
          codebaseOverviewPath: process.env.CODEBASE_OVERVIEW_PATH!,
          // TODO: These should be loaded based on time range extracted from query
          startDate: new Date(process.env.START_DATE!),
          endDate: new Date(process.env.END_DATE!),
        };

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
          observabilityPlatform: "datadog",
          observabilityFeatures: ["logs"],
          startDate: appConfig.startDate,
          endDate: appConfig.endDate,
          reasonOnly: options?.reasonOnly === true,
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
