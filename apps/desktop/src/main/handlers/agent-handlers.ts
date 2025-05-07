import { AgentAssistantMessage, AgentChatMessage } from "@renderer/types/index.js";
import { AgentConfigStore, invokeAgent } from "@triage/agent";
import { BrowserWindow, ipcMain } from "electron";
import { DEFAULT_END_DATE, DEFAULT_START_DATE } from "../tmp-hardcode.js";

/**
 * Set up all IPC handlers related to agent functionality
 * @param window The main browser window for sending updates
 */
export function setupAgentHandlers(window: BrowserWindow, agentCfgStore: AgentConfigStore): void {
  console.info("Setting up agent handlers...");

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
  ipcMain.removeHandler("agent:invoke-agent");
  console.info("Agent handlers cleanup complete.");
}
