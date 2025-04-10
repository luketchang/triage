/**
 * TypeScript definitions for the Electron API exposed to the renderer process.
 * This file ensures proper type checking when using window.electronAPI.
 */

// TODO: Can we not just import types from packages?
// Import the AgentConfig type from our configuration

// Define AgentConfig interface
export interface AgentConfig {
  repoPath: string;
  codebaseOverviewPath: string;
  observabilityPlatform: string;
  observabilityFeatures: string[];
  startDate: Date;
  endDate: Date;
}

// Define the interfaces for log and code objects
export interface Log {
  timestamp: string;
  message: string;
  service: string;
  level: string;
  attributes?: {
    [key: string]: any;
  };
  metadata?: Record<string, string>;
}

export interface Artifact {
  id: string;
  name: string;
  content: string;
}

// Define the interfaces for log and code postprocessing
interface LogPostprocessingResult {
  type: string;
  relevantQueries: any[];
  summary: string;
}

interface CodePostprocessingResult {
  type: string;
  relevantCode?: Record<string, string>;
  summary?: string;
}

// Define log search input type for type safety
export interface LogSearchInput {
  type: string;
  query: string;
  start: string;
  end: string;
  limit: number;
  reasoning: string;
  pageCursor?: string;
}

// Define logs with pagination type
export interface LogsWithPagination {
  logs: Log[];
  pageCursorOrIndicator?: string;
}

// Define log query params type
export interface LogQueryParams {
  query: string;
  start: string;
  end: string;
  limit: number;
  pageCursor?: string;
}

// Define facet data type
export interface FacetData {
  name: string;
  values: string[];
}

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
       * @returns Promise with the agent response
       */
      invokeAgent: (query: string) => Promise<
        ApiResponse<{
          chatHistory: string[];
          rca: string;
          logPostprocessing: Map<LogSearchInput, string | LogsWithPagination>;
          codePostprocessing: Map<string, string>;
          logContext: Map<LogSearchInput, string | LogsWithPagination>;
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
    };
  }
}

// This export is needed to make this a module
export {};
