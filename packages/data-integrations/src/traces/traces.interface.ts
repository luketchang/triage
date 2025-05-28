import { IntegrationType } from "../shared";
import {
  SpanSearchInput,
  SpansWithPagination,
  Trace,
  TraceSearchInput,
  TracesWithPagination,
} from "./types";

/**
 * Interface for traces platforms like Datadog and Grafana
 * Provides a common abstraction layer for fetching traces and spans data
 */
export interface TracesClient {
  integrationType: IntegrationType;

  /**
   * Get instructions for span search query specific to client's query language
   * @returns Instructions for span search query
   */
  getSpanSearchQueryInstructions(): string;

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
  getSpansFacetValues(
    start: string,
    end: string,
    facetList?: string[]
  ): Promise<Map<string, string[]>>;

  /**
   * Fetch spans from the observability platform
   * @param query - Query string to filter spans
   * @param start - Start time in ISO format
   * @param end - End time in ISO format
   * @param limit - Maximum number of results to return
   * @param pageCursor - Cursor for pagination
   * @returns SpansWithPagination object containing spans and pagination info
   */
  fetchSpans(params: SpanSearchInput): Promise<SpansWithPagination>;

  /**
   * Fetch traces from the observability platform
   * @param query - Query string to filter traces (returns traces containing matching spans)
   * @param start - Start time in ISO format
   * @param end - End time in ISO format
   * @param limit - Maximum number of results to return
   * @param pageCursor - Cursor for pagination
   * @returns TracesWithPagination object containing traces and pagination info
   */
  fetchTraces(params: TraceSearchInput): Promise<TracesWithPagination>;

  /**
   * Fetch a single trace by its ID
   * @param traceId - The ID of the trace to fetch
   * @param start - Start time in ISO format (optional, used if trace not in cache)
   * @param end - End time in ISO format (optional, used if trace not in cache)
   * @returns The trace if found, null otherwise
   */
  fetchTraceById(params: { traceId: string; start?: string; end?: string }): Promise<Trace | null>;
}
