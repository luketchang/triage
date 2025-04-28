/**
 * TypeScript definitions for the Electron API exposed to the renderer process.
 * This file ensures proper type checking when using window.electronAPI.
 */

// Import types from types.ts - this is the single source of truth for types
import {
  AgentConfig,
  CodePostprocessing,
  FacetData,
  Log,
  LogPostprocessing,
  LogQueryParams,
  LogSearchInputCore,
  LogsWithPagination,
  Trace,
  TraceQueryParams,
} from "./types";

// Define API response types with consistent error property
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Augment the Window interface to include our Electron API
declare global {
  interface Window {
    electronAPI: {
      /**
       * Invoke the agent with a query and return the result
       * @param query The query to send to the agent
       * @param logContext Optional map of log search inputs to their results
       * @param options Optional configuration options for the agent
       * @returns Promise with the agent response
       */
      invokeAgent: (
        query: string,
        logContext: Map<LogSearchInputCore, LogsWithPagination | string> | null,
        options?: { reasonOnly?: boolean }
      ) => Promise<
        ApiResponse<{
          chatHistory: string[];
          content: string | null;
          logPostprocessing: LogPostprocessing | null;
          codePostprocessing: CodePostprocessing | null;
          logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
          codeContext: Map<string, string>;
        }>
      >;

      /**
       * Get the current agent configuration
       * @returns Promise with the current agent configuration
       */
      getAgentConfig: () => Promise<AgentConfig>;

      /**
       * Update the agent configuration
       * @param config Partial configuration to merge with existing config
       * @returns Promise with the updated agent configuration
       */
      updateAgentConfig: (config: Partial<AgentConfig>) => Promise<AgentConfig>;

      /**
       * Fetch logs based on query parameters
       * @param params Query parameters for fetching logs
       * @returns Promise with the fetched logs
       */
      fetchLogs: (params: LogQueryParams) => Promise<
        ApiResponse<{
          logs: Log[];
          pageCursorOrIndicator?: string;
        }>
      >;

      /**
       * Get log facet values for a given time range
       * @param start Start date of the time range
       * @param end End date of the time range
       * @returns Promise with the fetched facet values
       */
      getLogsFacetValues: (start: string, end: string) => Promise<ApiResponse<FacetData[]>>;

      /**
       * Fetch traces based on query parameters
       * @param params Query parameters for fetching traces
       * @returns Promise with the fetched traces
       */
      fetchTraces: (params: TraceQueryParams) => Promise<
        ApiResponse<{
          traces: Trace[];
          pageCursorOrIndicator?: string;
        }>
      >;

      /**
       * Get span facet values for a given time range
       * @param start Start date of the time range
       * @param end End date of the time range
       * @returns Promise with the fetched facet values
       */
      getSpansFacetValues: (start: string, end: string) => Promise<ApiResponse<FacetData[]>>;
    };
  }
}

// This export is needed to make this a module
export {};
