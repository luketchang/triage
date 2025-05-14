import {
  AssistantMessage as AgentAssistantMessage,
  ChatMessage as AgentChatMessage,
  AgentConfigStore,
  invokeAgent,
} from "@triage/agent";
import { BrowserWindow, ipcMain } from "electron";
import { getLogger } from "@triage/common";
import { DEFAULT_END_DATE, DEFAULT_START_DATE } from "../tmp-hardcode.js";

/**
 * Set up all IPC handlers related to agent functionality
 * @param window The main browser window for sending updates
 */
export function setupAgentHandlers(window: BrowserWindow, agentCfgStore: AgentConfigStore): void {
  const logger = getLogger();
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

        const result = await invokeAgent({
          query,
          chatHistory,
          agentCfg,
          startDate: DEFAULT_START_DATE,
          endDate: DEFAULT_END_DATE,
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
  const logger = getLogger();
  ipcMain.removeHandler("agent:invoke-agent");
  logger.info("Agent handlers cleanup complete.");
}
