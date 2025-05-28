import { contextBridge, ipcRenderer } from "electron";
import { AssistantMessage, ChatMessage, UserMessage } from "../renderer/src/types/index.js";

// Store the environment values we're exposing for logging
const tracesEnabled = process.env.TRACES_ENABLED === "true";
const useMockApi = process.env.USE_MOCK_API === "true";

/**
 * Expose environment variables to the renderer process
 */
contextBridge.exposeInMainWorld("env", {
  TRACES_ENABLED: tracesEnabled,
  USE_MOCK_API: useMockApi,
});

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * Agent-related IPC functions
   */
  agent: {
    /**
     * Send a message to the agent via IPC and get a stream ID
     * @param prompt The prompt to send
     * @param history Chat history as plain objects
     * @returns Promise that resolves to a stream ID (string)
     */
    invoke: (userMessage: UserMessage, chatHistory: ChatMessage[]) => {
      return ipcRenderer.invoke("agent:invoke", userMessage, chatHistory);
    },

    /**
     * Subscribe to agent chunks for a stream
     * @param callback Function to call when chunk events are received
     * @returns Function to remove the listener
     */
    onChunk: (callback: (packet: any) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, packet: any) => callback(packet);
      ipcRenderer.on("agent:chunk", listener);
      return () => ipcRenderer.removeListener("agent:chunk", listener);
    },

    /**
     * Cancel an agent stream
     * @param streamId ID of the stream to cancel
     */
    cancel: (streamId: string) => {
      ipcRenderer.send("agent:cancel", streamId);
    },
  },

  /**
   * Get the current agent configuration
   */
  getAppConfig: () => ipcRenderer.invoke("config:get-app-config"),

  /**
   * Update the agent configuration
   * @param newConfig The new configuration to set
   */
  updateAppConfig: (newConfig: unknown) =>
    ipcRenderer.invoke("config:update-app-config", newConfig),

  /**
   * Fetch logs based on query parameters
   * @param params Query parameters for fetching logs
   */
  fetchLogs: (params: unknown) => ipcRenderer.invoke("observability:fetch-logs", params),

  /**
   * Get log facet values for a given time range
   * @param start Start date of the time range
   * @param end End date of the time range
   */
  getLogsFacetValues: (start: string, end: string) =>
    ipcRenderer.invoke("observability:get-logs-facet-values", start, end),

  /**
   * Fetch traces based on query parameters
   * @param params Query parameters for fetching traces
   */
  fetchTraces: (params: unknown) => ipcRenderer.invoke("observability:fetch-traces", params),

  /**
   * Get span facet values for a given time range
   * @param start Start date of the time range
   * @param end End date of the time range
   */
  getSpansFacetValues: (start: string, end: string) =>
    ipcRenderer.invoke("observability:get-spans-facet-values", start, end),

  /**
   * Fetch a Sentry event by specifier
   * @param params Parameters for fetching the Sentry event
   */
  fetchSentryEvent: (params: unknown) => ipcRenderer.invoke("sentry:fetch-event", params),

  /**
   * Create a new chat
   */
  createChat: () => ipcRenderer.invoke("db:create-chat"),

  /**
   * Get all chats
   */
  getAllChats: () => ipcRenderer.invoke("db:get-all-chats"),

  /**
   * Save a user message to the database
   * @param message The user message to save
   */
  saveUserMessage: (message: UserMessage, chatId: number) =>
    ipcRenderer.invoke("db:save-user-message", message, chatId),

  /**
   * Save an assistant message to the database
   * @param message The assistant message to save
   * @param chatId The ID of the chat to save to
   */
  saveAssistantMessage: (message: AssistantMessage, chatId: number) =>
    ipcRenderer.invoke("db:save-assistant-message", message, chatId),

  /**
   * Load messages from a specific chat
   * @param chatId The ID of the chat to load messages from
   */
  loadChatMessages: (chatId: number) => ipcRenderer.invoke("db:get-messages", chatId),

  /**
   * Delete a chat and all its messages
   * @param chatId The ID of the chat to delete
   */
  deleteChat: (chatId: number) => ipcRenderer.invoke("db:delete-chat", chatId),

  /**
   * Generate a codebase overview for the given repository path
   * @param repoPath The path to the repository
   */
  generateCodebaseOverview: (repoPath: string) =>
    ipcRenderer.invoke("codebase:generate-overview", repoPath),

  /**
   * Register a callback for codebase overview progress events
   * @param callback Function to call when a progress event is received
   */
  onCodebaseOverviewProgress: (callback: (update: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, update: any) => callback(update);
    ipcRenderer.on("codebase:overview-progress", listener);
    // Return a function to remove the listener when no longer needed
    return () => ipcRenderer.removeListener("codebase:overview-progress", listener);
  },
});

/**
 * Helper function to wait for DOM to be ready
 * @param condition ReadyState conditions to check
 * @returns Promise that resolves when DOM is ready
 */
function domReady(condition: DocumentReadyState[] = ["complete", "interactive"]): Promise<boolean> {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true);
    } else {
      document.addEventListener("readystatechange", () => {
        if (condition.includes(document.readyState)) {
          resolve(true);
        }
      });
    }
  });
}

// Perform any initialization logic when DOM is ready
domReady().then(() => {
  console.info("Preload script initialized");
  console.info("Environment variables exposed:", {
    TRACES_ENABLED: tracesEnabled,
    USE_MOCK_API: useMockApi,
  });
});
