import {
  AssistantMessage as AgentAssistantMessage,
  ChatMessage as AgentChatMessage,
  AgentConfigStore,
  invokeAgent,
} from "@triage/agent";
import { logger } from "@triage/common";
import { BrowserWindow, ipcMain } from "electron";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Set up all IPC handlers related to agent functionality
 * @param window The main browser window for sending updates
 */
export function setupAgentHandlers(window: BrowserWindow, agentCfgStore: AgentConfigStore): void {
  logger.info("Setting up agent handlers...");

  // Handle agent invocation
  ipcMain.handle(
    "agent:invoke-agent",
    async (
      _event: any,
      query: string,
      chatHistory: AgentChatMessage[]
    ): Promise<AgentAssistantMessage> => {
      try {
        logger.info("Invoking agent with query:", query);
        logger.info("IPC chat history:", chatHistory);

        const agentCfg = await agentCfgStore.getValues();

        // Send updates to renderer via window
        const onUpdate = (update: any) => {
          window.webContents.send("agent:agent-update", update);
        };

        // Calculate date range for last two weeks
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - TWO_WEEKS_MS);
        const result = await invokeAgent({
          query,
          chatHistory,
          agentCfg,
          startDate,
          endDate,
          onUpdate: onUpdate,
        });

        return result;
      } catch (error) {
        logger.error("Error invoking agent:", error);
        throw error;
      }
    }
  );

  logger.info("All agent handlers registered.");
}

/**
 * Clean up resources used by agent handlers
 */
export function cleanupAgentHandlers(): void {
  ipcMain.removeHandler("agent:invoke-agent");
  logger.info("Agent handlers cleanup complete.");
}
