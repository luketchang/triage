import { contextBridge, ipcRenderer } from "electron";

// Define the shape of the API
interface AgentResult {
  success: boolean;
  chatHistory?: string[];
  rootCauseAnalysis?: string | null;
  error?: string;
}

interface ElectronAPI {
  invokeAgent: (issue: string, repoPath: string) => Promise<AgentResult>;
  getCurrentDirectory: () => string;
}

// Get the current directory - this will be available in the preload context
const getCurrentDirectory = (): string => {
  try {
    return process.cwd();
  } catch (error) {
    console.error("Error getting current directory:", error);
    return "";
  }
};

// Expose specific APIs to the renderer process
contextBridge.exposeInMainWorld("api", {
  // Expose methods for invoking the agent
  invokeAgent: (issue: string, repoPath: string): Promise<AgentResult> => {
    return ipcRenderer.invoke("invoke-agent", issue, repoPath);
  },

  // Provide the current directory to help with the repository path field
  getCurrentDirectory: () => getCurrentDirectory(),
});
