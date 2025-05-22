/**
 * TypeScript definitions for the Electron API exposed to the renderer process.
 * This file ensures proper type checking when using window.electronAPI.
 */

// Import types from types.ts - this is the single source of truth for types
import { AppConfig } from "../../common/AppConfig.js";
import {
  AgentAssistantMessage,
  AgentChatMessage,
  AssistantMessage,
  Chat,
  ChatMessage,
  CodebaseOverview,
  CodebaseOverviewProgressUpdate,
  FacetData,
  LogSearchInput,
  LogsWithPagination,
  RetrieveSentryEventInput,
  SentryEvent,
  StreamUpdate,
  TraceSearchInput,
  TracesWithPagination,
  UserMessage,
} from "./types";

// Augment `window` to include everyting exposed in `preload/index.ts`
declare global {
  interface Window {
    env: {
      TRACES_ENABLED: boolean;
      USE_MOCK_API: boolean;
    };

    electronAPI: {
      /**
       * Invoke the agent with a query and return the result
       * @param query The query to send to the agent
       * @param chatHistory The chat history to send to the agent
       * @returns Promise with the agent response
       */
      invokeAgent: (
        query: string,
        chatHistory: AgentChatMessage[]
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
      fetchLogs: (params: LogSearchInput) => Promise<LogsWithPagination>;

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
      fetchTraces: (params: TraceSearchInput) => Promise<TracesWithPagination>;

      /**
       * Get span facet values for a given time range
       * @param start Start date of the time range
       * @param end End date of the time range
       * @returns Promise with the fetched facet values
       */
      getSpansFacetValues: (start: string, end: string) => Promise<FacetData[]>;

      /**
       * Fetch a Sentry event by specifier
       * @param params Parameters for fetching the Sentry event
       * @returns Promise with the fetched Sentry event
       */
      fetchSentryEvent: (params: RetrieveSentryEventInput) => Promise<SentryEvent>;

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
