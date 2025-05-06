// This file provides type definitions for modules without their own type definitions
import type {
  AgentStreamUpdate,
  AppConfig,
  AssistantMessage,
  ChatMessage,
  FacetData,
  LogQueryParams,
  LogsWithPagination,
  TraceQueryParams,
  TracesWithPagination,
  UserMessage,
} from "./types";

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
      chatHistory: ChatMessage[],
      options?: { reasonOnly?: boolean }
    ) => Promise<ChatMessage>;
    onAgentUpdate: (callback: (update: AgentStreamUpdate) => void) => () => void;
    getAppConfig: () => Promise<AppConfig>;
    updateAppConfig: (newConfig: AppConfig) => Promise<AppConfig>;

    // Observability methods
    fetchLogs: (params: LogQueryParams) => Promise<LogsWithPagination>;
    getLogsFacetValues: (start: string, end: string) => Promise<FacetData[]>;
    fetchTraces: (params: TraceQueryParams) => Promise<TracesWithPagination>;
    getSpansFacetValues: (start: string, end: string) => Promise<FacetData[]>;

    // Chat persistence methods
    saveUserMessage: (message: UserMessage) => Promise<number | null>;
    saveAssistantMessage: (message: AssistantMessage) => Promise<number | null>;
    loadChatMessages: () => Promise<ChatMessage[]>;
    clearChat: () => Promise<boolean>;
  }
}

// This export is needed to make this a module
export {};
