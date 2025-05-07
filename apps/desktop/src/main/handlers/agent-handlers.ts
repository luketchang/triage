import { AgentAssistantMessage, AgentChatMessage } from "@renderer/types/index.js";
import { invokeAgent } from "@triage/agent";
import { appConfig } from "@triage/config";
import { BrowserWindow, ipcMain } from "electron";
import {
  DEFAULT_END_DATE,
  DEFAULT_INTEGRATION_TYPE,
  DEFAULT_OBSERVABILITY_FEATURES,
  DEFAULT_START_DATE,
} from "../tmp-hardcode.js";

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
          integrationType: DEFAULT_INTEGRATION_TYPE,
          observabilityFeatures: DEFAULT_OBSERVABILITY_FEATURES,
          startDate: DEFAULT_START_DATE,
          endDate: DEFAULT_END_DATE,
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
