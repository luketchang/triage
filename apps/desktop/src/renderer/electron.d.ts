/**
 * TypeScript definitions for the Electron API exposed to the renderer process.
 * This file ensures proper type checking when using window.electronAPI.
 */

// Import the AgentConfig type from our configuration
import type { AgentConfig } from "../config";

// Augment the Window interface to include our Electron API
declare global {
  interface Window {
    electronAPI: {
      /**
       * Invoke the agent with a query and return the result
       * @param query The query to send to the agent
       * @returns Promise with the agent response
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
       * @returns Promise with the current agent configuration
       */
      getAgentConfig: () => Promise<AgentConfig>;

      /**
       * Update the agent configuration
       * @param newConfig Partial configuration to merge with existing config
       * @returns Promise with the updated agent configuration
       */
      updateAgentConfig: (newConfig: Partial<AgentConfig>) => Promise<AgentConfig>;
    };
  }
}

// This export is needed to make this a module
export {};
