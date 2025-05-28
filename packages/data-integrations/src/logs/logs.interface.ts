import { IntegrationType } from "../shared";
import { LogSearchInput, LogsWithPagination } from "./types";

/**
 * Interface for logs platforms like Datadog and Grafana
 * Provides a common abstraction layer for fetching logs data
 */
export interface LogsClient {
  integrationType: IntegrationType;

  /**
   * Get instructions for log search query specific to client's query language
   * @returns Instructions for log search query
   */
  getLogSearchQueryInstructions(): string;

  /**
   * Add keywords to a query
   * @param keywords - Keywords to add to the query
   * @returns Query with keywords added
   */
  addKeywordsToQuery(query: string, keywords: string[]): string;

  /**
   * Get a map of labels to their corresponding values for the given time range
   * @param start - Start time in ISO format
   * @param end - End time in ISO format
   * @returns Map of facet names to their possible values
   */
  getLogsFacetValues(
    start: string,
    end: string,
    facetList?: string[]
  ): Promise<Map<string, string[]>>;

  /**
   * Fetch logs from the observability platform
   * @param query - Query string to filter logs
   * @param start - Start time in ISO format
   * @param end - End time in ISO format
   * @param limit - Maximum number of results to return
   * @param pageCursor - Cursor for pagination
   * @returns Array of Log objects
   */
  fetchLogs(params: LogSearchInput): Promise<LogsWithPagination>;
}
