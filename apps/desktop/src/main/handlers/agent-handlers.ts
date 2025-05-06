import { AgentAssistantMessage, AgentChatMessage, invokeAgent } from "@renderer/types/index.js";
import {} from "@triage/agent";
import { AppConfig } from "@triage/config";
import { BrowserWindow, ipcMain } from "electron";

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
          // TODO: Hardcode these here until we implement proper handling
          // for them (and expose them in the UI)
          observabilityPlatform: "datadog",
          observabilityFeatures: ["logs"],
          startDate: new Date("2025-04-16T21:00:00Z"),
          endDate: new Date("2025-04-16T23:59:59Z"),
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
