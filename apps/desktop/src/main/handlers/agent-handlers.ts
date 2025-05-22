import {
  AssistantMessage as AgentAssistantMessage,
  ChatMessage as AgentChatMessage,
  UserMessage as AgentUserMessage,
  AgentConfigStore,
  invokeAgent,
} from "@triage/agent";
import { logger } from "@triage/common";
import { BrowserWindow, ipcMain } from "electron";
import { registerHandler } from "./register-util.js";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Set up all IPC handlers related to agent functionality
 * @param window The main browser window for sending updates
 */
export function setupAgentHandlers(window: BrowserWindow, agentCfgStore: AgentConfigStore): void {
  logger.info("Setting up agent handlers...");

  // Handle agent invocation
  registerHandler(
    "agent:invoke-agent",
    async (
      _event: any,
      userMessage: AgentUserMessage,
      chatHistory: AgentChatMessage[]
    ): Promise<AgentAssistantMessage> => {
      try {
        logger.info("Invoking agent with message:", userMessage.content);
        logger.info("Context items:", userMessage.contextItems || []);
        logger.info("IPC chat history:", chatHistory);

        const agentCfg = await agentCfgStore.getValues();

        // NOTE: we set timezone every agent call to handle edge cases where timezone changes while app still open
        agentCfg.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.info("Setting timezone to:", agentCfg.timezone);

        // Send updates to renderer via window
        const onUpdate = (update: any) => {
          window.webContents.send("agent:agent-update", update);
        };

        // Calculate date range for last two weeks
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - TWO_WEEKS_MS);

        const result = await invokeAgent({
          userMessage,
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

  window.on("close", () => {
    ipcMain.removeAllListeners("agent:invoke-agent");
  });

  logger.info("All agent handlers registered.");
}

/**
 * Clean up resources used by agent handlers
 */
export function cleanupAgentHandlers(): void {
  ipcMain.removeHandler("agent:invoke-agent");
  logger.info("Agent handlers cleanup complete.");
}
