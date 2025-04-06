import { contextBridge, ipcRenderer } from "electron";

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * Invoke the agent with a query and return the result
   * @param query The query to send to the agent
   */
  invokeAgent: (query: string) => ipcRenderer.invoke("invoke-agent", query),

  /**
   * Get the current agent configuration
   */
  getAgentConfig: () => ipcRenderer.invoke("get-agent-config"),

  /**
   * Update the agent configuration
   * @param newConfig The new configuration to set
   */
  updateAgentConfig: (newConfig: unknown) => ipcRenderer.invoke("update-agent-config", newConfig),
});
