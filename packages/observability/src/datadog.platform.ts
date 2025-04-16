import { client, v2 } from "@datadog/datadog-api-client";
import { logger } from "@triage/common";
import { config } from "@triage/config";
import { ObservabilityPlatform } from "./observability.interface";
import {
  IntegrationType,
  Log,
  LogsWithPagination,
  Span,
  SpansWithPagination,
  TracesWithPagination,
} from "./types";

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

const DATADOG_LOG_SEARCH_INSTRUCTIONS = `
Use Datadog Log Search Syntax to search for logs.

## Example queries:
  - service:<service_name>
  - service:<service_name> AND "<keyword in log line>"
  - service:<service_name> AND *:"<keyword in attributes>"
  - service:<service_name> AND status:error

## Tips
- Excluding the service attribute, when using attribute filters, use *:"<keyword>" instead of a specific attribute like <attribute>:"<keyword>" ()

## Best practices (examples):
- GOOD: (service:orders OR service:payments) AND (*:"67ec59004bb8930018a81adc" OR *:"67ec59004bb8930018a81def")
- GOOD: (service:orders OR service:payments OR service:tickets OR service:expiration)
- GOOD: service:tickets AND status:info
- GOOD: service:orders AND (*:"No matching document" OR *:"duplicate key")
- BAD (missing AND clauses): service:orders (*:"No matching document" OR *:"duplicate key")
- BAD (doesn't include service names): *
- BAD (wrong tag for log severity, should be "status" not "level"): service:orders AND level:error
- BAD (missing quotes around keyword terms): service:orders *:No matching document *:duplicate key
- BAD (uses specific attribute tag instead of using *): service:orders item:"<keyword>"

## Pagination
- Page cursors are a feature in Datadog log and span search that allows you to paginate through results.
- The presence of a page cursor in a response indicates that there are more results from that request that were not yet returned because of the limit.
- If you need to fetch the additional results from the same query, include the page cursor from the previous response in your next request.
`;

const DATADOG_DEFAULT_FACET_LIST_LOGS = ["service", "status"];
const DATADOG_DEFAULT_FACET_LIST_SPANS = ["service", "resource", "operation_name", "status"];

export class DatadogPlatform implements ObservabilityPlatform {
  integrationType: IntegrationType = IntegrationType.DATADOG;
  private apiKey: string;
  private appKey: string;
  private site: string;
  private configuration: client.Configuration;
  private logsApiInstance: v2.LogsApi;
  private spansApiInstance: v2.SpansApi;

  constructor() {
    // Get credentials from environment config
    if (!config.datadog.apiKey || !config.datadog.appKey || !config.datadog.site) {
      throw new Error("Datadog environment configuration is missing required values");
    }
    this.apiKey = config.datadog.apiKey;
    this.appKey = config.datadog.appKey;
    this.site = config.datadog.site;

    // Initialize Datadog client with these credentials
    this.configuration = client.createConfiguration({
      authMethods: {
        apiKeyAuth: this.apiKey,
        appKeyAuth: this.appKey,
      },
    });
    this.configuration.setServerVariables({
      site: this.site,
    });

    // Create API clients
    this.logsApiInstance = new v2.LogsApi(this.configuration);
    this.spansApiInstance = new v2.SpansApi(this.configuration);
  }

  getSpanSearchQueryInstructions(): string {
    return DATADOG_SPAN_SEARCH_INSTRUCTIONS;
  }

  getLogSearchQueryInstructions(): string {
    return DATADOG_LOG_SEARCH_INSTRUCTIONS;
  }

  async getSpansFacetValues(
    start: string,
    end: string,
    facetList: string[] = DATADOG_DEFAULT_FACET_LIST_SPANS
  ): Promise<Map<string, string[]>> {
    const spansMap = new Map<string, string[]>();
    for (const facet of facetList) {
      logger.info(`Fetching facet values for ${facet}`);
      const spanValues = await this.fetchFacetValuesSpans(start, end, facet);
      logger.info(`Facet values for ${facet}: ${spanValues}`);
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

  async getLogsFacetValues(
    start: string,
    end: string,
    facetList: string[] = DATADOG_DEFAULT_FACET_LIST_LOGS
  ): Promise<Map<string, string[]>> {
    const logsMap = new Map<string, string[]>();
    for (const facet of facetList) {
      const logValues = await this.fetchFacetValuesLogs(start, end, facet);
      logsMap.set(facet, logValues);
    }
    return logsMap;
  }

  private async fetchFacetValuesLogs(start: string, end: string, facet: string): Promise<string[]> {
    const response = await this.logsApiInstance.aggregateLogs({
      body: {
        compute: [
          {
            aggregation: "count",
            type: "total",
          },
        ],
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
    });
    const buckets: v2.LogsAggregateBucket[] = response.data?.buckets || [];
    const uniqueValues = new Set<string>();
    buckets.forEach((bucket: v2.LogsAggregateBucket) => {
      if (bucket.by && bucket.by[facet]) {
        uniqueValues.add(bucket.by[facet] as string);
      }
    });
    return Array.from(uniqueValues);
  }

  async fetchSpans(params: {
    query: string;
    start: string;
    end: string;
    limit: number;
    pageCursor?: string;
  }): Promise<SpansWithPagination> {
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

  async fetchTraces(params: {
    query: string;
    start: string;
    end: string;
    limit: number;
    pageCursor?: string;
  }): Promise<TracesWithPagination> {
    throw new Error("fetchTraces is not implemented for Datadog platform");
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

  async fetchLogs(params: {
    query: string;
    start: string;
    end: string;
    limit: number;
    pageCursor?: string;
  }): Promise<LogsWithPagination> {
    try {
      logger.info(`Executing GET query: ${params.query}`);
      logger.info(`Time range: ${params.start} to ${params.end}`);
      logger.info(`Limit: ${params.limit}`);
      logger.info(`Cursor: ${params.pageCursor}`);

      const response = await this.logsApiInstance.listLogsGet({
        filterQuery: params.query,
        filterFrom: new Date(params.start),
        filterTo: new Date(params.end),
        sort: "timestamp",
        pageLimit: params.limit,
        pageCursor: params.pageCursor,
      });

      if (response && response.data && response.data.length > 0) {
        logger.info(`Found ${response.data.length} logs`);
        const logs = this.formatLogs(response.data);
        return {
          logs,
          pageCursorOrIndicator: response.meta?.page?.after,
        };
      } else {
        logger.info("No logs found with GET endpoint");
        return {
          logs: [],
          pageCursorOrIndicator: undefined,
        };
      }
    } catch (error) {
      logger.error(`Error executing log query with GET endpoint: ${error}`);
      return {
        logs: [],
        pageCursorOrIndicator: undefined,
      };
    }
  }

  private formatLogs(logs: v2.Log[]): Log[] {
    if (!logs || logs.length === 0) {
      return [];
    }

    return logs.map((log) => {
      const serviceName = log.attributes?.service || "N/A";
      const timestamp = log.attributes?.timestamp
        ? new Date(log.attributes.timestamp).toISOString()
        : new Date().toISOString();
      const content = log.attributes?.message || "N/A";
      const level = log.attributes?.status || "info";

      // Extract all other attributes as metadata
      const metadata: Record<string, string> = {};
      if (log.attributes) {
        Object.entries(log.attributes).forEach(([key, value]) => {
          // Skip attributes we've already used in main fields
          if (
            !["service", "timestamp", "message", "status"].includes(key) &&
            typeof value === "string"
          ) {
            metadata[key] = value;
          }
        });
      }

      // Add host if available
      if (log.attributes?.host) {
        metadata["host"] = String(log.attributes.host);
      }

      // Add Datadog-specific tags
      metadata["source"] = "datadog";

      // Look for a specific nested 'attributes' field
      let nestedAttributes;

      // Check if attributes itself has an 'attributes' field
      if (log.attributes?.attributes) {
        if (typeof log.attributes.attributes === "string") {
          try {
            // Try to parse it as JSON if it's a string
            nestedAttributes = JSON.parse(log.attributes.attributes);
          } catch (e) {
            // If not valid JSON, use as is
            nestedAttributes = log.attributes.attributes;
          }
        } else {
          // Use as is if it's already an object
          nestedAttributes = log.attributes.attributes;
        }
      }

      return {
        timestamp,
        message: content,
        service: serviceName,
        level,
        attributes: nestedAttributes,
        metadata,
      };
    });
  }
}
