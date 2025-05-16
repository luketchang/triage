/**
 * TypeScript definitions for the Electron API exposed to the renderer process.
 * This file ensures proper type checking when using window.electronAPI.
 */

// Import types from types.ts - this is the single source of truth for types
import { AppConfig } from "../../common/AppConfig.js";
import {
  AssistantMessage,
  Chat,
  ChatMessage,
  CodebaseOverview,
  CodebaseOverviewProgressUpdate,
  FacetData,
  LogQueryParams,
  LogsWithPagination,
  TraceQueryParams,
  TracesWithPagination,
  UserMessage,
} from "./types";

/**
 * Interface for consuming streaming responses.
 */
export interface ResponseStream extends AsyncIterable<any> {
  /**
   * Cancels the current stream
   */
  cancel(): void;
}

// Augment `window` to include everyting exposed in `preload/index.ts`
declare global {
  interface Window {
    env: {
      TRACES_ENABLED: boolean;
      USE_MOCK_API: boolean;
    };

    electronAPI: {
      /**
       * Agent-related IPC functions
       */
      agent: {
        /**
         * Send a message to the agent via IPC and get a stream ID
         * @param prompt The prompt to send
         * @param history Chat history as plain objects
         * @returns Promise that resolves to a stream ID (string)
         */
        invoke(prompt: string, history: { role: string; content: string }[]): Promise<string>;

        /**
         * Subscribe to agent chunks for a stream
         * @param callback Function to call when chunk events are received
         * @returns Function to remove the listener
         */
        onChunk(callback: (packet: any) => void): () => void;

        /**
         * Cancel an agent stream
         * @param streamId ID of the stream to cancel
         */
        cancel(streamId: string): void;
      };

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
       * Create a new chat
       * @returns Promise with the created chat or null if failed
       */
      createChat: () => Promise<Chat>;

      /**
       * Get all chats
       * @returns Promise with an array of chats
       */
      getAllChats: () => Promise<Chat[]>;

      /**
       * Save a user message to the database
       * @param message The user message to save
       * @returns Promise with the saved message ID or null if failed
       */
      saveUserMessage: (message: UserMessage, chatId: number) => Promise<number | null>;

      /**
       * Save an assistant message to the database
       * @param message The message to save
       * @param chatId The ID of the chat to save to
       * @returns Promise with message ID
       */
      saveAssistantMessage: (message: AssistantMessage, chatId: number) => Promise<number | null>;

      /**
       * Load messages for a specific chat
       * @param chatId The ID of the chat to load messages from
       * @returns Promise with chat messages
       */
      loadChatMessages: (chatId: number) => Promise<ChatMessage[]>;

      /**
       * Delete a chat and all its messages
       * @param chatId The ID of the chat to delete
       * @returns Promise with success status
       */
      deleteChat: (chatId: number) => Promise<boolean>;

      /**
       * Generate a codebase overview for the given repository path
       * @param repoPath Path to the repository
       * @returns Promise resolving to the path of the generated overview file
       */
      generateCodebaseOverview: (repoPath: string) => Promise<CodebaseOverview>;

      /**
       * Register for codebase overview progress events
       * @param callback Function called when progress updates are received
       * @returns Function to unsubscribe from events
       */
      onCodebaseOverviewProgress: (
        callback: (update: CodebaseOverviewProgressUpdate) => void
      ) => () => void;
    };
  }
}
