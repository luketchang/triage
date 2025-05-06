/**
 * TypeScript definitions for the Electron API exposed to the renderer process.
 * This file ensures proper type checking when using window.electronAPI.
 */

// Import types from types.ts - this is the single source of truth for types
import { AppConfig } from "@triage/config";
import {
  AgentAssistantMessage,
  AgentChatMessage,
  AssistantMessage,
  ChatMessage,
  FacetData,
  LogQueryParams,
  LogsWithPagination,
  StreamUpdate,
  TraceQueryParams,
  TracesWithPagination,
  UserMessage,
} from "./types";

// Augment the Window interface to include our Electron API
declare global {
  interface Window {
    electronAPI: {
      /**
       * Invoke the agent with a query and return the result
       * @param query The query to send to the agent
       * @param chatHistory The chat history to send to the agent
       * @param options Optional configuration options for the agent
       * @returns Promise with the agent response
       */
      invokeAgent: (
        query: string,
        chatHistory: AgentChatMessage[],
        options?: { reasonOnly?: boolean }
      ) => Promise<AgentAssistantMessage>;

      /**
       * Register a callback for agent update events
       * @param callback Function to call when an agent update is received
       * @returns Function to remove the event listener
       */
      onAgentUpdate: (callback: (update: StreamUpdate) => void) => () => void;

      /**
       * Get the current agent configuration
       * @returns Promise with the current agent configuration
       */
      getAppConfig: () => Promise<AppConfig>;

      /**
       * Update the agent configuration
       * @param config Partial configuration to merge with existing config
       * @returns Promise with the updated agent configuration
       */
      updateAppConfig: (config: Partial<AppConfig>) => Promise<AppConfig>;

      /**
       * Fetch logs based on query parameters
       * @param params Query parameters for fetching logs
       * @returns Promise with the fetched logs
       */
      fetchLogs: (params: LogQueryParams) => Promise<LogsWithPagination>;

      /**
       * Get log facet values for a given time range
       * @param start Start date of the time range
       * @param end End date of the time range
       * @returns Promise with the fetched facet values
       */
      getLogsFacetValues: (start: string, end: string) => Promise<FacetData[]>;

      /**
       * Fetch traces based on query parameters
       * @param params Query parameters for fetching traces
       * @returns Promise with the fetched traces
       */
      fetchTraces: (params: TraceQueryParams) => Promise<TracesWithPagination>;

      /**
       * Get span facet values for a given time range
       * @param start Start date of the time range
       * @param end End date of the time range
       * @returns Promise with the fetched facet values
       */
      getSpansFacetValues: (start: string, end: string) => Promise<FacetData[]>;

      /**
       * Save a user message to the database
       * @param message The user message to save
       * @returns Promise with the saved message ID or null if failed
       */
      saveUserMessage: (message: UserMessage) => Promise<number | null>;

      /**
       * Save an assistant message to the database
       * @param message The assistant message to save
       * @returns Promise with the saved message ID or null if failed
       */
      saveAssistantMessage: (message: AssistantMessage) => Promise<number | null>;

      /**
       * Load all messages from the current chat
       * @returns Promise with an array of chat messages
       */
      loadChatMessages: () => Promise<ChatMessage[]>;

      /**
       * Clear the current chat from database and memory
       * @returns Promise with success status
       */
      clearChat: () => Promise<boolean>;
    };
  }
}

// This export is needed to make this a module
export {};
