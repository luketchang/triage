import { AgentStreamUpdate, ChatMessage } from "@triage/agent";
import { contextBridge, ipcRenderer } from "electron";

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
   * @param options Optional configuration options for the agent
   */
  invokeAgent: (query: string, chatHistory: ChatMessage[], options?: { reasonOnly?: boolean }) => {
    return ipcRenderer.invoke("invoke-agent", query, chatHistory, options);
  },

  /**
   * Register a callback for agent update events
   * @param callback Function to call when an agent update is received
   */
  onAgentUpdate: (callback: (update: AgentStreamUpdate) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, update: AgentStreamUpdate) =>
      callback(update);
    ipcRenderer.on("agent-update", listener);
    // Return a function to remove the listener when no longer needed
    return () => {
      ipcRenderer.removeListener("agent-update", listener);
    };
  },

  /**
   * Get the current agent configuration
   */
  getAgentConfig: () => ipcRenderer.invoke("get-agent-config"),

  /**
   * Update the agent configuration
   * @param newConfig The new configuration to set
   */
  updateAgentConfig: (newConfig: unknown) => ipcRenderer.invoke("update-agent-config", newConfig),

  /**
   * Fetch logs based on query parameters
   * @param params Query parameters for fetching logs
   */
  fetchLogs: (params: unknown) => ipcRenderer.invoke("fetch-logs", params),

  /**
   * Get log facet values for a given time range
   * @param start Start date of the time range
   * @param end End date of the time range
   */
  getLogsFacetValues: (start: string, end: string) =>
    ipcRenderer.invoke("get-logs-facet-values", start, end),

  /**
   * Fetch traces based on query parameters
   * @param params Query parameters for fetching traces
   */
  fetchTraces: (params: unknown) => ipcRenderer.invoke("fetch-traces", params),

  /**
   * Get span facet values for a given time range
   * @param start Start date of the time range
   * @param end End date of the time range
   */
  getSpansFacetValues: (start: string, end: string) =>
    ipcRenderer.invoke("get-spans-facet-values", start, end),

  /**
   * Get the file tree structure for a repository path
   * @param repoPath Path to the repository
   */
  getFileTree: (repoPath: string) => ipcRenderer.invoke("get-file-tree", repoPath),

  /**
   * Get the content of a file
   * @param repoPath Base repository path
   * @param filePath Relative file path within repository
   */
  getFileContent: (repoPath: string, filePath: string) =>
    ipcRenderer.invoke("get-file-content", repoPath, filePath),
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
  console.log("Preload script initialized");
  console.log("Environment variables exposed:", {
    TRACES_ENABLED: tracesEnabled,
    USE_MOCK_API: useMockApi,
  });
});
