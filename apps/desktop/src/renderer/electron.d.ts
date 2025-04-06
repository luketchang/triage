// This file ensures TypeScript recognizes the types from the Triage packages

// Import the AgentConfig type
import type { AgentConfig } from "../config";

// A placeholder for future Electron API integration
declare global {
  interface Window {
    // Will be defined when we add Electron integration
    electronAPI: {
      /**
       * Invoke the agent with a query and return the result
       * @param query The query to send to the agent
       */
      invokeAgent: (query: string) => Promise<{
        success: boolean;
        data?: {
          chatHistory: string[];
          rca: string | null;
          logPostprocessing: unknown | null;
          codePostprocessing: unknown | null;
        };
        error?: string;
      }>;

      /**
       * Get the current agent configuration
       */
      getAgentConfig: () => Promise<AgentConfig>;

      /**
       * Update the agent configuration
       * @param newConfig The new configuration to set
       */
      updateAgentConfig: (newConfig: Partial<AgentConfig>) => Promise<AgentConfig>;
    };
  }
}

// This export is needed to make this a module
export {};
