// This file provides type definitions for modules without their own type definitions

// Allow importing components, features, etc. without type errors
declare module "*/components/*";
declare module "*/features/*";
declare module "*/hooks/*";
declare module "*/icons/*";
declare module "*/services/*";
declare module "*/types/*";
declare module "*/utils/*";

/**
 * Global type declarations for custom window properties
 */

declare global {
  interface Window {
    /**
     * Electron API bridge
     */
    electronAPI: ElectronAPI;

    /**
     * Environment variables exposed to renderer
     */
    env: {
      TRACES_ENABLED: boolean;
      USE_MOCK_API: boolean;
    };
  }

  interface ElectronAPI {
    // Agent methods
    invokeAgent: (
      query: string,
      chatHistory: import("./types").ChatMessage[],
      options?: { reasonOnly?: boolean }
    ) => Promise<import("./types").ChatMessage>;
    onAgentUpdate: (callback: (update: import("./types").AgentStreamUpdate) => void) => () => void;
    getAgentConfig: () => Promise<import("./types").AgentConfig>;
    updateAgentConfig: (
      newConfig: import("./types").AgentConfig
    ) => Promise<import("./types").AgentConfig>;

    // Observability methods
    fetchLogs: (
      params: import("./types").LogQueryParams
    ) => Promise<import("./types").LogsWithPagination>;
    getLogsFacetValues: (start: string, end: string) => Promise<import("./types").FacetData[]>;
    fetchTraces: (
      params: import("./types").TraceQueryParams
    ) => Promise<import("./types").TracesWithPagination>;
    getSpansFacetValues: (start: string, end: string) => Promise<import("./types").FacetData[]>;

    // Chat persistence methods
    saveUserMessage: (message: import("./types").UserMessage) => Promise<number | null>;
    saveAssistantMessage: (message: import("./types").AssistantMessage) => Promise<number | null>;
    loadChatMessages: () => Promise<import("./types").ChatMessage[]>;
    clearChat: () => Promise<boolean>;
  }
}

// This export is needed to make this a module
export {};
