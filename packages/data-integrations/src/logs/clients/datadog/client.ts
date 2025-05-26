import { client, v2 } from "@datadog/datadog-api-client";
import { logger } from "@triage/common";

import { DatadogConfig } from "../../../config";
import { LogsClient } from "../../logs.interface";
import { IntegrationType, Log, LogSearchInput, LogsWithPagination } from "../../types";

const DATADOG_LOG_SEARCH_INSTRUCTIONS = `
Use Datadog Log Search Syntax to search for logs.

## Example queries:
  - service:<service_name>
  - service:<service_name> AND "<keyword in log line>"
  - service:<service_name> AND *:"<keyword in attributes>"
  - service:<service_name> AND status:error

## Rules
- Excluding the service attribute, when using attribute filters, use *:"<keyword>" instead of a specific attribute like <attribute>:"<keyword>"
- If you are going to use an attribute filter, always use the * key. Attribute filters with specific words for the key (first term before the colon) are NOT allowed.
- If you use attribute filters, you must always use a colon (:) between the * and the keyword (i.e. *:"<keyword>")

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
- BAD (missing colon for attribute filter): service:orders *"<keyword>"

## Pagination
- Page cursors are a feature in Datadog log and span search that allows you to paginate through results.
- The presence of a page cursor in a response indicates that there are more results from that request that were not yet returned because of the limit.
- If you need to fetch the additional results from the same query, include the page cursor from the previous response in your next request.
`;

const DATADOG_DEFAULT_FACET_LIST_LOGS = ["service", "status"];

export class DatadogLogsClient implements LogsClient {
  integrationType: IntegrationType = IntegrationType.DATADOG;
  private apiKey: string;
  private appKey: string;
  private site: string;
  private logsApiInstance: v2.LogsApi;

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
    this.logsApiInstance = new v2.LogsApi(clientCfg);
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

  getLogSearchQueryInstructions(): string {
    return DATADOG_LOG_SEARCH_INSTRUCTIONS;
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

  async fetchLogs(params: LogSearchInput): Promise<LogsWithPagination> {
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
          } catch {
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
