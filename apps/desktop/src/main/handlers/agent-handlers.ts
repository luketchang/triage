import {
  AssistantMessage as AgentAssistantMessage,
  ChatMessage as AgentChatMessage,
  AgentConfigStore,
  UserMessage as AgentUserMessage,
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
        // ***** NEW DETAILED IPC DEBUGGING *****
        console.log("--- agent-handlers.ts: Received userMessage from IPC ---");
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log("Type of userMessage argument as received:", typeof userMessage);

        if (userMessage && typeof userMessage === "object") {
          console.log("Keys of userMessage object:", Object.keys(userMessage));
          // Iterate over properties and log them individually
          for (const key in userMessage) {
            if (Object.prototype.hasOwnProperty.call(userMessage, key)) {
              // @ts-ignore - accessing dynamically
              const value = userMessage[key];
              let valueToLog = value;
              try {
                // Attempt to stringify complex values, but keep it brief
                if (typeof value === "object" && value !== null) {
                  valueToLog =
                    JSON.stringify(value)?.substring(0, 200) +
                    (JSON.stringify(value)?.length > 200 ? "..." : "");
                }
              } catch (e) {
                valueToLog = `[Error stringifying value for key ${key}]`;
              }
              console.log(`  userMessage['${key}'] (type: ${typeof value}):`, valueToLog);
            }
          }
          // Final check on content specifically
          // @ts-ignore
          console.log("userMessage.content specifically:", userMessage.content);
          // @ts-ignore
          console.log("Type of userMessage.content specifically:", typeof userMessage.content);

          // Attempt to stringify the whole object, but catch errors
          try {
            console.log(
              "userMessage (full JSON.stringify attempt):",
              JSON.stringify(userMessage, null, 2)
            );
          } catch (e: any) {
            console.error(
              "Error stringifying the entire userMessage object in agent-handlers:",
              e.message
            );
          }
        } else {
          console.log(
            "userMessage is not a valid object or is null/undefined upon arrival:",
            userMessage
          );
        }
        console.log("------------------------------------------------------");
        // ***************************************

        // Original logging (can be kept for comparison or modified)
        logger.info("Invoking agent with message content:", userMessage?.content);
        logger.info(
          "Context items received in userMessage:",
          userMessage?.contextItems ? userMessage.contextItems.length : "No contextItems field"
        );
        logger.info("IPC chat history length:", chatHistory?.length);

        const agentCfg = await agentCfgStore.getValues();

        // NOTE: we set timezone every agent call to handle edge cases where timezone changes while app still open
        agentCfg.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.info("Setting timezone to:", agentCfg.timezone);

        // Send updates to renderer via window
        const onUpdate = (update: any) => {
          logger.info(`Sending agent update to renderer: ${JSON.stringify(update)}`);
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
          onUpdate,
        });
        console.info("Returning agent response:", result);

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
