import { AgentStreamUpdate, ChatMessage } from "@triage/agent";
import { contextBridge, ipcRenderer } from "electron";
import { AssistantMessage, UserMessage } from "../renderer/src/types/index.js";

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
   * Invoke the agent with a query and return the result
   * @param query The query to send to the agent
   * @param chatHistory The chat history to send to the agent
   */
  invokeAgent: (query: string, chatHistory: ChatMessage[]) => {
    return ipcRenderer.invoke("agent:invoke-agent", query, chatHistory);
  },

  /**
   * Register a callback for agent update events
   * @param callback Function to call when an agent update is received
   */
  onAgentUpdate: (callback: (update: AgentStreamUpdate) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, update: AgentStreamUpdate) =>
      callback(update);
    ipcRenderer.on("agent:agent-update", listener);
    // Return a function to remove the listener when no longer needed
    return () => {
      ipcRenderer.removeListener("agent:agent-update", listener);
    };
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
  saveUserMessage: (message: UserMessage) => ipcRenderer.invoke("db:save-user-message", message),

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
   * Clear messages from a chat (keeping the chat entry)
   * @param chatId The ID of the chat to clear
   */
  clearChat: (chatId: number) => ipcRenderer.invoke("db:clear-messages", chatId),

  /**
   * Delete a chat and all its messages
   * @param chatId The ID of the chat to delete
   */
  deleteChat: (chatId: number) => ipcRenderer.invoke("db:delete-chat", chatId),
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
