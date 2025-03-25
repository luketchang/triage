import { IntegrationType } from "./types";

/**
 * Interface for observability platforms like Datadog and Grafana
 * Provides a common abstraction layer for fetching observability data
 */
export interface ObservabilityPlatform {
  integrationType: IntegrationType;

  /**
   * Get instructions for span search query specific to platform's query language
   * @returns Instructions for span search query
   */
  getSpanSearchQueryInstructions(): string;

  /**
   * Get instructions for log search query specific to platform's query language
   * @returns Instructions for log search query
   */
  getLogSearchQueryInstructions(): string;

  /**
   * Get a map of labels to their corresponding values for the given time range
   * @param start - Start time in ISO format
   * @param end - End time in ISO format
   * @returns JSON string representation of the map
   */
  getSpansFacetValues(start: string, end: string): Promise<string>;

  /**
   * Get a map of labels to their corresponding values for the given time range
   * @param start - Start time in ISO format
   * @param end - End time in ISO format
   * @returns JSON string representation of the map
   */
  getLogsFacetValues(start: string, end: string): Promise<string>;

  /**
   * Fetch spans start the observability platform
   * @param query - Query string to filter spans
   * @param start - Start time in ISO format
   * @param to - End time in ISO format
   * @param limit - Maximum number of results to return
   * @param pageCursor - Cursor for pagination
   * @returns JSON string representation of spans
   */
  fetchSpans(params: {
    query: string;
    start: string;
    end: string;
    limit: number;
    pageCursor?: string;
  }): Promise<string>;

  /**
   * Fetch logs start the observability platform
   * @param query - Query string to filter logs
   * @param start - Start time in ISO format
   * @param end - End time in ISO format
   * @param limit - Maximum number of results to return
   * @param pageCursor - Cursor for pagination
   * @returns JSON string representation of logs
   */
  fetchLogs(params: {
    query: string;
    start: string;
    end: string;
    limit: number;
    pageCursor?: string;
  }): Promise<string>;
}
