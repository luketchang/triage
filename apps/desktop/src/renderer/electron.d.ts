export interface AgentResult {
  success: boolean;
  chatHistory?: string[];
  rootCauseAnalysis?: string | null;
  error?: string;
}

export interface ElectronAPI {
  invokeAgent: (issue: string, repoPath: string) => Promise<AgentResult>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
