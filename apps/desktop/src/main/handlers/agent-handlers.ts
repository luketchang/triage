import {
  ChatMessage as AgentChatMessage,
  AgentConfigStore,
  UserMessage as AgentUserMessage,
  invokeAgent,
} from "@triage/agent";
import { logger } from "@triage/common";
import { randomUUID } from "crypto";
import { BrowserWindow, ipcMain } from "electron";
import { registerHandler } from "./register-util.js";

interface StreamInfo {
  controller: AbortController;
  win: BrowserWindow;
}

// Store active streams by ID
const streams = new Map<string, StreamInfo>();

// Two weeks in milliseconds for date range
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Set up all IPC handlers related to agent functionality
 * @param window The main browser window for sending updates
 * @param cfgStore The agent configuration store
 */
export function setupAgentHandlers(window: BrowserWindow, cfgStore: AgentConfigStore): void {
  logger.info("Setting up agent handlers...");

  // Handle agent invocation and return stream ID
  registerHandler(
    "agent:invoke",
    async (
      _event: any,
      userMessage: AgentUserMessage,
      chatHistory: AgentChatMessage[]
    ): Promise<string> => {
      logger.info("Invoking agent with message content:", userMessage?.content);
      logger.info(
        "Context items received in userMessage:",
        userMessage?.contextItems ? userMessage.contextItems.length : "No contextItems field"
      );
      logger.info("IPC chat history length:", chatHistory?.length);

      // Create a stream ID, to be immediately returned to the client after we
      // start agent processing
      const streamId = randomUUID();
      const controller = new AbortController();
      streams.set(streamId, { controller, win: window });
      // Create a callback to asynchronously send updates to the client
      const onUpdate = (update: any) => {
        if (controller.signal.aborted) return;
        window.webContents.send("agent:update", { id: streamId, chunk: update });
      };

      // Start agent processing
      setImmediate(async () => {
        try {
          const agentCfg = await cfgStore.getValues();

          // NOTE: we set timezone every agent call to handle edge cases where timezone changes while app still open
          agentCfg.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          console.info("Setting timezone to:", agentCfg.timezone);

          // Calculate date range for last two weeks
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - TWO_WEEKS_MS);

          const result = await invokeAgent({
            userMessage,
            chatHistory,
            agentCfg,
            options: {
              startDate,
              endDate,
            },
            onUpdate,
            abortSignal: controller.signal,
          });

          // At this point, all updates have been sent and all processing is complete,
          // so just send the "done" signal
          window.webContents.send("agent:update", { id: streamId, done: true, result });
        } catch (error) {
          logger.error(`Error in agent stream ${streamId}:`, error);

          // If aborted, send cancelled update, otherwise send error update
          if (controller.signal.aborted) {
            window.webContents.send("agent:update", {
              id: streamId,
              error: "cancelled",
              done: true,
            });
          } else {
            window.webContents.send("agent:update", {
              id: streamId,
              error: error instanceof Error ? error.message : String(error),
              done: true,
            });
          }
        } finally {
          // Clean up stream info
          streams.delete(streamId);
        }
      });

      return streamId;
    }
  );

  // Handle stream cancellation
  ipcMain.on("agent:cancel", (_event, streamId: string) => {
    logger.info(`Cancelling agent stream ${streamId}`);
    const stream = streams.get(streamId);

    if (stream) {
      stream.controller.abort();
      streams.delete(streamId);
    }
  });

  logger.info("All agent handlers registered.");
}

/**
 * Clean up resources used by agent handlers
 */
export function cleanupAgentHandlers(): void {
  logger.info("Cleaning up agent handlers");

  // Abort all active streams
  for (const [streamId, stream] of streams.entries()) {
    logger.info(`Aborting agent stream ${streamId}`);
    stream.controller.abort();
  }

  streams.clear();

  // Remove IPC handlers
  ipcMain.removeHandler("agent:invoke");
  ipcMain.removeAllListeners("agent:cancel");

  logger.info("Agent handlers cleanup complete.");
}
