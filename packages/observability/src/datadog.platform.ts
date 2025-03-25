import { client, v2 } from "@datadog/datadog-api-client";
import { logger, renderFacetValues } from "@triage/common";
import { config } from "@triage/config";
import { ObservabilityPlatform } from "./observability.interface";
import { IntegrationType } from "./types";

const DATADOG_SPAN_SEARCH_INSTRUCTIONS = `
# Datadog APM Query Syntax Tutorial

This guide will help you quickly understand how to create effective queries in Datadog APM Trace Explorer.

## Basic Query Structure

Datadog APM queries consist of:
- **Span attributes**: Properties of spans (prefixed with @)
- **Span tags**: Metadata about spans (no prefix needed)
- **Boolean operators**: AND, OR, - (NOT)

## Query Examples by Complexity

### Simple Queries

# Find traces from a specific service
service:concierge-server

# Find all error spans
status:error

# Find spans with a specific operation
operation_name:http.request

### Using Wildcards

# Find all async worker operations
operation_name:async.worker_*

# Find all document-related operations
operation_name:*document*

### Numerical Comparisons

# Find slow database queries (>500ms)
service:postgres @duration:>500ms

# Find HTTP requests with 4xx status codes
operation_name:http.request @http.status_code:[400 TO 499]

### Combining Conditions

# Find API errors from specific services
service:(nexus-server OR nexus-worker) status:error operation_name:fastapi.request

# Exclude certain spans
service:concierge-worker -operation_name:*zendesk*

### Advanced Attribute Searches

# Search nested attributes
@git.commit.sha:12345

# Search for specific error messages
status:error @error.msg:*timeout*

### Infrastructure Tags

# Find spans from a specific host
host:datadog-agent.railway.internal

# Find spans from production environment with errors
env:production status:error

## Pro Tips

1. **Use the autocomplete feature** in the search bar to discover available attributes and tags
2. **Save common searches** for quick access later
3. **Escape special characters** like =, :, or spaces with a backslash (\\)
4. **Use time range selector** to narrow your focus to relevant time periods
5. **Add columns** to the span table to see important attributes at a glance

## Real-World Examples for Our Services


# Track all AI API calls
operation_name:(openai.request OR anthropic.request)

# Find slow file processing operations
operation_name:(*file* OR *document*) @duration:>1s 

# Debug Zendesk ticket handling errors
service:concierge-worker operation_name:*zendesk* status:error

# Monitor database performance
service:(postgres OR redis) @duration:>200ms

Remember that building effective queries allows you to quickly identify and troubleshoot issues in complex distributed systems!
`;

const DATADOG_LOG_SEARCH_INSTRUCTIONS = `
# Datadog Log Query Syntax Tutorial

This guide will help you quickly understand how to create effective queries in Datadog Log Explorer.

## Basic Query Structure

Datadog log queries consist of:
- **Log attributes**: Properties of logs (prefixed with @ when used for attribute searches)
- **Log tags**: Metadata attached to logs (commonly inherited from hosts and integrations)
- **Keyword search**: Finds text within log messages or all attributes
- **Boolean operators**: AND, OR, - (NOT)

## Keyword Search

### Basic Keyword Search
# Find logs containing "timeout" in the message
timeout

# Find logs containing "database error" as an exact phrase
"database error"

### Full-Text Search (All Attributes)
# Search for "timeout" in any log attribute (not just the message)
*:timeout

# Search for logs containing an exact phrase in any attribute
*:"database connection failed"

### Wildcards
# Match all logs with words starting with "error"
*:error*

# Find logs with messages that contain "network" anywhere
*network*

### Excluding Keywords
# Find error logs but exclude those containing "timeout"
status:error AND -"timeout"

### Escaping Special Characters
# Search for an email address stored in an attribute
@user.email:john.doe@example.com

## Query Examples by Complexity

### Simple Queries

# Find logs from a specific source
@source:concierge-server

# Find all error logs
status:error

# Find logs containing a specific keyword in the message
"database error"

### Using Wildcards

# Find logs from a service starting with "web"
service:web*

# Find all logs with messages that contain "timeout"
*timeout*

### Numerical Comparisons

# Find logs with response times over 500ms
@http.response_time:>500ms

# Find HTTP logs with 4xx status codes
@http.status_code:[400 TO 499]

### Combining Conditions

# Find API errors from specific sources
(@source:nexus-server OR @source:nexus-worker) AND status:error AND "fastapi"

# Exclude logs from a particular process
@service:concierge-worker AND -("zendesk")

### Advanced Attribute Searches

# Search nested attributes in logs
@git.commit.sha:12345

# Search for logs with specific error messages
status:error AND @error.msg:*timeout*

### Infrastructure Tags

# Find logs from a specific host
host:datadog-agent.railway.internal

# Find logs from the production environment with errors
env:production AND status:error

## Real-World Examples for Our Services

# Track all AI API call logs
("openai.request" OR "anthropic.request")

# Find slow file processing logs
("file" OR "document") AND @duration:>1s 

# Debug Zendesk ticket handling errors in logs
@service:concierge-worker AND "zendesk" AND status:error

# Monitor database performance logs
(@service:postgres OR @service:redis) AND @duration:>200ms

Building effective log queries helps you quickly identify and troubleshoot issues across your systems!
`;

enum DatadogDefaultFacetsSpans {
  SERVICE = "service",
  RESOURCE = "resource",
  OPERATION_NAME = "operation_name",
  HOST = "host",
  STATUS = "status",
  ENV = "env",
}
enum DatadogDefaultFacetsLogs {
  SERVICE = "service",
}
const DATADOG_DEFAULT_FACET_LIST_SPANS = Object.values(DatadogDefaultFacetsSpans);
const DATADOG_DEFAULT_FACET_LIST_LOGS = Object.values(DatadogDefaultFacetsLogs);

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

  async getSpansFacetValues(from: string, end: string): Promise<string> {
    const facetMap = await this.getFacetToFacetValueMapSpans(from, end);
    return renderFacetValues(facetMap);
  }

  async getFacetToFacetValueMapSpans(
    start: string,
    end: string,
    facetList: DatadogDefaultFacetsSpans[] = DATADOG_DEFAULT_FACET_LIST_SPANS
  ): Promise<Map<DatadogDefaultFacetsSpans, string[]>> {
    const spansMap = new Map<DatadogDefaultFacetsSpans, string[]>();
    for (const facet of facetList) {
      const spanValues = await this.fetchFacetValuesSpans(start, end, facet);
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

  async getLogsFacetValues(from: string, end: string): Promise<string> {
    const facetMap = await this.getFacetToFacetValueMapLogs(from, end);
    return renderFacetValues(facetMap);
  }

  async getFacetToFacetValueMapLogs(
    start: string,
    end: string,
    facetList: DatadogDefaultFacetsLogs[] = DATADOG_DEFAULT_FACET_LIST_LOGS
  ): Promise<Map<DatadogDefaultFacetsLogs, string[]>> {
    const logsMap = new Map<DatadogDefaultFacetsLogs, string[]>();
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
  }): Promise<string> {
    try {
      logger.info(`Executing GET query: ${params.query}`);
      logger.info(`Time range: ${params.start} to ${params.end}`);
      logger.info(`Limit: ${params.limit}`);
      logger.info(`Cursor: ${params.pageCursor}`);

      const response = await this.spansApiInstance.listSpansGet({
        filterQuery: params.query,
        filterFrom: params.start,
        filterTo: params.end,
        sort: "-timestamp",
        pageLimit: params.limit,
        pageCursor: params.pageCursor,
      });

      if (response && response.data && response.data.length > 0) {
        logger.info(`Found ${response.data.length} spans`);
        return this.formatSpans(response.data);
      } else {
        logger.info("No spans found with GET endpoint");
        return "No spans found matching the query.";
      }
    } catch (error) {
      logger.error(`Error executing span query with GET endpoint: ${error}`);
      return "Error executing span query with GET endpoint.";
    }
  }

  private formatSpans(spans: v2.Span[]): string {
    if (!spans || spans.length === 0) {
      return "No spans found matching the query.";
    }
    return spans
      .map((span, index) => {
        return `[${index + 1}] Span ID: ${span.id || "N/A"}
      Service: ${span.attributes?.service || "N/A"}
      Resource: ${span.attributes?.resourceName || "N/A"}
      Trace ID: ${span.attributes?.traceId || "N/A"}
      Span ID: ${span.attributes?.spanId || "N/A"}
      Parent ID: ${span.attributes?.parentId || "N/A"}
      Start: ${span.attributes?.startTimestamp ? new Date(span.attributes.startTimestamp).toISOString() : "N/A"}
      End: ${span.attributes?.endTimestamp ? new Date(span.attributes.endTimestamp).toISOString() : "N/A"}
      Additional Attributes: ${JSON.stringify(span.attributes)}
      `;
      })
      .join("\n\n");
  }

  async fetchLogs(params: {
    query: string;
    start: string;
    end: string;
    limit: number;
    pageCursor?: string;
  }): Promise<string> {
    try {
      logger.info(`Executing GET query: ${params.query}`);
      logger.info(`Time range: ${params.start} to ${params.end}`);
      logger.info(`Limit: ${params.limit}`);
      logger.info(`Cursor: ${params.pageCursor}`);

      const response = await this.logsApiInstance.listLogsGet({
        filterQuery: params.query,
        filterFrom: new Date(params.start),
        filterTo: new Date(params.end),
        sort: "-timestamp",
        pageLimit: params.limit,
        pageCursor: params.pageCursor,
      });

      if (response && response.data && response.data.length > 0) {
        logger.info(`Found ${response.data.length} logs`);
        return this.formatLogs(response.data);
      } else {
        logger.info("No logs found with GET endpoint");
        return "No logs found matching the query.";
      }
    } catch (error) {
      logger.error(`Error executing log query with GET endpoint: ${error}`);
      return "Error executing log query with GET endpoint.";
    }
  }

  private formatLogs(logs: v2.Log[]): string {
    if (!logs || logs.length === 0) {
      return "No logs found matching the query.";
    }
    return logs
      .map((log) => {
        const serviceName = log.attributes?.service || "N/A";
        const timestamp = log.attributes?.timestamp
          ? new Date(log.attributes.timestamp).toISOString()
          : "N/A";
        const content = log.attributes?.message || "N/A";

        return `${serviceName} ${timestamp} ${content}`;
      })
      .join("\n");
  }
}
