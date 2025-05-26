import { client, v2 } from "@datadog/datadog-api-client";
import { logger } from "@triage/common";

import { DatadogConfig } from "../../../config";
import { TracesClient } from "../../traces.interface";
import {
  IntegrationType,
  Span,
  SpanSearchInput,
  SpansWithPagination,
  Trace,
  TraceSearchInput,
  TracesWithPagination,
} from "../../types";

import { convertSpansToTrace, extractTraceIds } from "./utils";

const DATADOG_SPAN_SEARCH_INSTRUCTIONS = `
- Use Datadog Span Search syntax to query spans within APM traces.

## Reserved Attributes: 
- env
- service
- operation_name
- resource_name
- status
- trace_id

## Standard Attributes: 
- @duration
- @http.status_code

TODO: ...

## Pagination
- Page cursors are a feature in Datadog span search that allows you to paginate through results.
- The presence of a page cursor in a response indicates that there are more results from that request that were not yet returned because of the limit.
- If you need to fetch the additional results from the same query, include the page cursor from the previous response in your next request.
`;

const DATADOG_DEFAULT_FACET_LIST_SPANS = ["service"]; // TODO: add operation_name, resource, status

export class DatadogTracesClient implements TracesClient {
  integrationType: IntegrationType = IntegrationType.DATADOG;
  private apiKey: string;
  private appKey: string;
  private site: string;
  private spansApiInstance: v2.SpansApi;
  private traceCache: Map<string, Trace> = new Map();

  constructor(cfg: DatadogConfig) {
    this.apiKey = cfg.apiKey;
    this.appKey = cfg.appKey;
    this.site = cfg.site;

    const clientCfg = client.createConfiguration({
      authMethods: {
        apiKeyAuth: this.apiKey,
        appKeyAuth: this.appKey,
      },
    });
    clientCfg.setServerVariables({
      site: this.site,
    });
    this.spansApiInstance = new v2.SpansApi(clientCfg);
  }

  addKeywordsToQuery(query: string, keywords: string[]): string {
    if (!keywords || keywords.length === 0) {
      return query;
    }

    // Escape quotes in keywords
    const escapedKeywords = keywords.map((kw) => kw.replace(/"/g, '\\"'));

    // Create Datadog search syntax for keywords
    // In Datadog, we use quoted terms with OR between them
    const keywordClause = escapedKeywords.map((kw) => `"${kw}"`).join(" OR ");

    // If there are multiple keywords, wrap them in parentheses
    const formattedKeywords = escapedKeywords.length > 1 ? `(${keywordClause})` : keywordClause;

    // Add the keyword clause to the query
    // If the query is empty or just "*", replace it with the keywords
    if (!query || query.trim() === "*") {
      return formattedKeywords;
    }

    // Otherwise, append the keywords with OR
    return `${query} OR ${formattedKeywords}`;
  }

  getSpanSearchQueryInstructions(): string {
    return DATADOG_SPAN_SEARCH_INSTRUCTIONS;
  }

  async getSpansFacetValues(
    start: string,
    end: string,
    facetList: string[] = DATADOG_DEFAULT_FACET_LIST_SPANS
  ): Promise<Map<string, string[]>> {
    const spansMap = new Map<string, string[]>();
    for (const facet of facetList) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      logger.info(`Fetching facet values for ${facet}`);
      const spanValues = await this.fetchFacetValuesSpans(start, end, facet);
      logger.info(`Span facet values for ${facet}: ${spanValues}`);
      spansMap.set(facet, spanValues);
    }
    return spansMap;
  }

  private async fetchFacetValuesSpans(
    start: string,
    end: string,
    facet: string
  ): Promise<string[]> {
    const response = await this.spansApiInstance.aggregateSpans({
      body: {
        data: {
          attributes: {
            filter: {
              from: start,
              to: end,
              query: "*",
            },
            groupBy: [
              {
                facet: facet,
                limit: 1000,
              },
            ],
          },
          type: "aggregate_request",
        },
      },
    });
    const buckets: v2.SpansAggregateBucket[] = response.data || [];
    const uniqueValues = new Set<string>();
    buckets.forEach((bucket: v2.SpansAggregateBucket) => {
      if (bucket.attributes && bucket.attributes.by && bucket.attributes.by[facet]) {
        uniqueValues.add(bucket.attributes.by[facet] as string);
      }
    });
    return Array.from(uniqueValues);
  }

  async fetchSpans(params: SpanSearchInput): Promise<SpansWithPagination> {
    try {
      logger.info(`Executing GET query: ${params.query}`);
      logger.info(`Time range: ${params.start} to ${params.end}`);
      logger.info(`Limit: ${params.limit}`);
      logger.info(`Cursor: ${params.pageCursor}`);

      const response = await this.spansApiInstance.listSpansGet({
        filterQuery: params.query,
        filterFrom: params.start,
        filterTo: params.end,
        sort: "timestamp",
        pageLimit: params.limit,
        pageCursor: params.pageCursor,
      });

      if (response && response.data && response.data.length > 0) {
        logger.info(`Found ${response.data.length} spans`);
        const spans = this.formatSpans(response.data);
        return {
          spans,
          pageCursorOrIndicator: response.meta?.page?.after,
        };
      } else {
        logger.info("No spans found with GET endpoint");
        return {
          spans: [],
          pageCursorOrIndicator: undefined,
        };
      }
    } catch (error) {
      logger.error(`Error executing span query with GET endpoint: ${error}`);
      return {
        spans: [],
        pageCursorOrIndicator: undefined,
      };
    }
  }

  /**
   * Execute a spans search API call and return the response.
   */
  private async searchSpans(
    query: string,
    fromTime: string,
    toTime: string,
    limit: number = 1000,
    cursor?: string
  ): Promise<v2.SpansListResponse> {
    try {
      const response = await this.spansApiInstance.listSpansGet({
        filterQuery: query,
        filterFrom: fromTime,
        filterTo: toTime,
        sort: "timestamp",
        pageLimit: limit,
        pageCursor: cursor,
      });
      return response;
    } catch (error) {
      logger.error(`Error searching spans: ${error}`);
      throw error;
    }
  }

  /**
   * Fetch all spans for a set of trace IDs in a single query
   */
  private async getAllSpansForTraces(
    traceIds: string[],
    fromTime: string,
    toTime: string,
    limit: number = 1000
  ): Promise<v2.Span[]> {
    if (traceIds.length === 0) {
      return [];
    }

    // Build query of the form: trace_id:(id1 OR id2 OR id3 ...)
    const query = `trace_id:(${traceIds.join(" OR ")})`;
    const results = await this.searchSpans(query, fromTime, toTime, limit);
    return results.data || [];
  }

  /**
   * Fetch traces based on a span query
   */
  async fetchTraces(params: TraceSearchInput): Promise<TracesWithPagination> {
    try {
      logger.info(`Fetching traces with query: ${params.query}`);
      logger.info(`Time range: ${params.start} to ${params.end}`);
      logger.info(`Limit: ${params.limit}`);
      logger.info(`Cursor: ${params.pageCursor}`);

      // 1) search for spans → get trace IDs
      const searchResult = await this.searchSpans(
        params.query,
        params.start,
        params.end,
        params.limit,
        params.pageCursor
      );
      const traceIds = extractTraceIds(searchResult.data || []);
      if (traceIds.length === 0) {
        return { traces: [], pageCursorOrIndicator: undefined };
      }

      // 2) fetch all spans for those trace IDs
      const allSpans = await this.getAllSpansForTraces(traceIds, params.start, params.end);

      // 3) group spans by trace, convert to Trace objects
      const traceMap: Record<string, v2.Span[]> = {};
      allSpans.forEach((span) => {
        const tid = span.attributes?.traceId!;
        traceMap[tid] = traceMap[tid] || [];
        traceMap[tid].push(span);
      });
      const traces: Trace[] = Object.entries(traceMap).map(([tid, spanList]) => {
        const t = convertSpansToTrace(spanList, tid);
        if (t) this.traceCache.set(tid, t);
        return t!;
      });
      // newest first
      traces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

      // — — — — — — — — — — — — — — — — — —
      // 👇 NEW BLOCK: one aggregate call to get pc75/90/95/99 per resource
      // 4a) collect all root-span resources
      const rootResources = Array.from(new Set(traces.map((t) => t.rootResource)));

      if (rootResources.length > 0) {
        const aggResp = await this.spansApiInstance.aggregateSpans({
          body: {
            data: {
              type: "aggregate_request",
              attributes: {
                filter: {
                  from: params.start,
                  to: params.end,
                  // restrict to only those resources, or leave '*' if you want global percentiles
                  query: `resource_name:(${rootResources.map((r) => `"${r}"`).join(" OR ")})`,
                },
                groupBy: [{ facet: "resource_name", limit: rootResources.length }],
                compute: [
                  { aggregation: "pc75", metric: "@duration", type: "total" },
                  { aggregation: "pc90", metric: "@duration", type: "total" },
                  { aggregation: "pc95", metric: "@duration", type: "total" },
                  { aggregation: "pc99", metric: "@duration", type: "total" },
                ],
              },
            },
          },
        });

        // build a map: resource → { p75, p90, p95, p99 }
        const pctMap = new Map<
          string,
          {
            p75: number;
            p90: number;
            p95: number;
            p99: number;
          }
        >();
        (aggResp.data || []).forEach((bucket) => {
          const resName = bucket.attributes?.by?.resource_name as string;
          const comps = bucket.attributes?.compute as Record<string, number>;
          pctMap.set(resName, {
            p75: comps["c0"] ?? comps["pc75"]!,
            p90: comps["c1"] ?? comps["pc90"]!,
            p95: comps["c2"] ?? comps["pc95"]!,
            p99: comps["c3"] ?? comps["pc99"]!,
          });
        });

        // 4b) annotate each trace's root span with its percentile bucket
        traces.forEach((t) => {
          const rootResource = t.rootResource;
          if (!rootResource) return;
          const resource = rootResource;
          const d = t.duration; // ms
          const thresholds = pctMap.get(resource);
          if (!thresholds) return;

          let bucket: string;
          if (d <= thresholds.p75) bucket = "<=p75";
          else if (d <= thresholds.p90) bucket = "<=p90";
          else if (d <= thresholds.p95) bucket = "<=p95";
          else if (d <= thresholds.p99) bucket = "<=p99";
          else bucket = ">p99";

          // stash it in metadata
          t.rootLatencyPercentile = bucket;
        });
      }
      // — — — — — — — — — — — — — — —

      return {
        traces,
        pageCursorOrIndicator: searchResult.meta?.page?.after,
      };
    } catch (error) {
      logger.error(`Error fetching traces: ${error}`);
      return { traces: [], pageCursorOrIndicator: undefined };
    }
  }

  /**
   * Fetch a single trace by its ID
   */
  async fetchTraceById(params: {
    traceId: string;
    start?: string;
    end?: string;
  }): Promise<Trace | null> {
    const { traceId, start, end } = params;

    // Check if the trace is in the cache
    if (this.traceCache.has(traceId)) {
      logger.info(`Trace ${traceId} found in cache`);
      return this.traceCache.get(traceId) || null;
    }

    logger.info(`Trace ${traceId} not found in cache, fetching from API`);

    // If not in cache, we need time range parameters
    if (!start || !end) {
      logger.warn(`Cannot fetch trace ${traceId} without time range parameters`);
      return null;
    }

    try {
      // Query for all spans in this trace
      const query = `trace_id:${traceId}`;
      const searchResult = await this.searchSpans(query, start, end, 1000);

      if (!searchResult.data || searchResult.data.length === 0) {
        logger.info(`No spans found for trace ID: ${traceId}`);
        return null;
      }

      // Convert spans to a trace object
      const trace = convertSpansToTrace(searchResult.data, traceId);

      // If successful, cache the result
      if (trace) {
        this.traceCache.set(traceId, trace);
      }

      return trace;
    } catch (error) {
      logger.error(`Error fetching trace by ID: ${error}`);
      return null;
    }
  }

  private formatSpans(spans: v2.Span[]): Span[] {
    if (!spans || spans.length === 0) {
      return [];
    }

    return spans.map((span) => {
      // Extract core attributes
      const spanId = span.attributes?.spanId || span.id || "N/A";
      const traceId = span.attributes?.traceId || "N/A";
      const service = span.attributes?.service || "N/A";
      const operation = span.attributes?.additionalProperties?.operation_name || "N/A";

      // Calculate timestamps and duration
      const startTimeDate = span.attributes?.startTimestamp
        ? new Date(span.attributes.startTimestamp)
        : new Date(0);
      const endTimeDate = span.attributes?.endTimestamp
        ? new Date(span.attributes.endTimestamp)
        : new Date(0);

      // Convert to ISO string for compatibility with the Span type
      const startTime = startTimeDate.toISOString();
      const endTime = endTimeDate.toISOString();

      const duration = Math.round(endTimeDate.getTime() - startTimeDate.getTime());

      // Extract status and environment
      // Access status through additionalProperties since it's not directly on attributes
      const status = span.attributes?.additionalProperties?.status || undefined;
      const environment = span.attributes?.additionalProperties?.env || undefined;

      // Extract additional metadata
      const metadata: Record<string, string> = {
        source: "datadog",
      };

      // Add resource name if available
      if (span.attributes?.resourceName) {
        metadata["resource"] = span.attributes.resourceName;
      }

      // Add parent ID if available
      if (span.attributes?.parentId) {
        metadata["parentId"] = span.attributes.parentId;
      }

      // Add other additional properties as metadata
      if (span.attributes?.additionalProperties) {
        Object.entries(span.attributes.additionalProperties).forEach(([key, value]) => {
          if (key !== "status" && key !== "env" && key !== "operation_name") {
            if (typeof value === "string") {
              metadata[key] = value;
            } else if (value !== null && value !== undefined) {
              metadata[key] = String(value);
            }
          }
        });
      }

      return {
        spanId,
        traceId,
        service,
        operation,
        startTime,
        endTime,
        duration,
        status,
        environment,
        metadata,
      };
    });
  }
}
