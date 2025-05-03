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
      chatHistory: any[],
      options?: { reasonOnly?: boolean }
    ) => Promise<any>;
    onAgentUpdate: (callback: (update: any) => void) => () => void;
    getAgentConfig: () => Promise<any>;
    updateAgentConfig: (newConfig: any) => Promise<any>;

    // Observability methods
    fetchLogs: (params: any) => Promise<any>;
    getLogsFacetValues: (start: string, end: string) => Promise<any>;
    fetchTraces: (params: any) => Promise<any>;
    getSpansFacetValues: (start: string, end: string) => Promise<any>;

    // File system methods
    getFileTree?: (path: string) => Promise<any>;
    getFileContent?: (path: string) => Promise<any>;

    // Chat persistence methods
    saveUserMessage: (message: any) => Promise<number | null>;
    saveAssistantMessage: (message: any) => Promise<number | null>;
    loadChatMessages: () => Promise<any[]>;
    clearChat: () => Promise<boolean>;
    getDatabaseStats: () => Promise<any>;
  }
}

// This export is needed to make this a module
export {};
