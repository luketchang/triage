import { logger, toUnixNano } from "@triage/common";
import axios from "axios";

import { GrafanaConfig } from "../../config";
import { ObservabilityClient } from "../../observability.interface";
import {
  IntegrationType,
  Log,
  LogSearchInput,
  LogsWithPagination,
  PaginationStatus,
  SpanSearchInput,
  SpansWithPagination,
  Trace,
  TraceSearchInput,
  TracesWithPagination,
} from "../../types";

export const GRAFANA_LOG_SEARCH_INSTRUCTIONS = `
## LogQL Syntax
- Use Grafana LogQL queries to search for logs.
- All log queries must be formulated as valid LogQL Loki queries (i.e. selectors wrapped in curly braces {} followed by keyword searches denoted by "|=" or regex searches denoted by "|~")
- Example LogQL query: {service_name="<service_name>"} |= <keyword> |~ <regex>
- You can inspect multiple services' logs in same query as in this example: {service_name=~"<service1>|<service2>"}
- Every query must include at least one label/selector in the curly braces, empty selectors (e.g., curly braces with no content such as {}) are not allowed
- If you query for log level, use keyword or regex search (e.g. |~ "(?i)error" for searching error logs), DO NOT use "level" tag in the query braces only use keywords

## Pagination
- Grafana does not support page cursors. You can infer if there are more results if the number of results returned is equal to the limit.
- If the number of logs returned equals the limit, more logs may be available — continue fetching by updating the next query's \`start\` time to just after the last returned log's timestamp.
`;

enum GrafanaDefaultFacetsLogs {
  SERVICE_NAME = "service_name",
}

const GRAFANA_DEFAULT_FACET_LIST = Object.values(GrafanaDefaultFacetsLogs);

// Define proper response interfaces for better type safety
interface GrafanaLogsResponse {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      stream: Record<string, string>;
      values: Array<[string, string]>;
    }>;
  };
}

interface GrafanaLabelsResponse {
  status: string;
  data: string[];
}

interface GrafanaLabelValuesResponse {
  status: string;
  data: string[];
}

interface GrafanaErrorResponse {
  message?: string;
  error?: string;
}

export class GrafanaClient implements ObservabilityClient {
  integrationType: IntegrationType = IntegrationType.GRAFANA;
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor(cfg: GrafanaConfig) {
    this.baseUrl = cfg.baseUrl;
    this.username = cfg.username;
    this.password = cfg.password;
  }

  addKeywordsToQuery(query: string, keywords: string[]): string {
    if (!keywords || keywords.length === 0) {
      return query;
    }

    // Escape special characters in keywords
    const escapedKeywords = keywords.map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    // For LogQL, we need to add the keywords using the |= operator
    // with a regex that checks for any of the keywords
    // If the query already contains pipe operators, append our new condition
    if (escapedKeywords.length === 1) {
      return `${query} |= "${escapedKeywords[0]}"`;
    } else {
      // For multiple keywords, create an OR condition using regex alternation
      const keywordPattern = escapedKeywords.join("|");
      return `${query} |~ "(?i)(${keywordPattern})"`;
    }
  }

  getSpanSearchQueryInstructions(): string {
    throw new Error("getSpanSearchQueryInstructions is not implemented for Grafana client");
  }

  getLogSearchQueryInstructions(): string {
    return GRAFANA_LOG_SEARCH_INSTRUCTIONS;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSpansFacetValues(start: string, end: string): Promise<Map<string, string[]>> {
    throw new Error("getFacetToFacetValuesMapSpans is not implemented for Grafana client");
  }

  async getLogsFacetValues(
    start: string,
    end: string,
    facetList: string[] = GRAFANA_DEFAULT_FACET_LIST
  ): Promise<Map<string, string[]>> {
    const labelsMap = new Map<string, string[]>();
    // For each label, fetch its corresponding values
    for (const label of facetList) {
      const values = await this.fetchLabelValuesLogs(label, start, end);
      labelsMap.set(label, values);
    }
    return labelsMap;
  }

  private async fetchLabelValuesLogs(label: string, start: string, end: string): Promise<string[]> {
    const url = `${this.baseUrl}/loki/api/v1/label/${label}/values`;
    const params = {
      start: toUnixNano(start),
      end: toUnixNano(end),
    };
    try {
      const response = await axios.get<GrafanaLabelValuesResponse>(url, {
        params,
        auth: {
          username: this.username,
          password: this.password,
        },
      });
      if (response.status === 200 && response.data && response.data.status === "success") {
        return response.data.data || [];
      }
      return [];
    } catch (error) {
      logger.error(`Error fetching values for label '${label}': ${String(error)}`);
      return [];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fetchSpans(params: SpanSearchInput): Promise<SpansWithPagination> {
    throw new Error("fetchSpans is not implemented for Grafana client");
  }

  async fetchLogs(params: LogSearchInput): Promise<LogsWithPagination> {
    try {
      const url = `${this.baseUrl}/loki/api/v1/query_range`;

      logger.info(`Executing Loki query: ${params.query}`);
      logger.info(`Original time range: ${params.start} to ${params.end}`);

      const requestParams = {
        query: params.query,
        start: toUnixNano(params.start),
        end: toUnixNano(params.end),
        limit: params.limit,
      };

      const response = await axios.get<GrafanaLogsResponse>(url, {
        params: requestParams,
        auth: {
          username: this.username,
          password: this.password,
        },
        timeout: 30000, // Adding 30 second timeout
      });

      if (response.status === 200 && response.data && response.data.status === "success") {
        const logs = this.formatLogs(response.data);
        return {
          logs,
          pageCursorOrIndicator:
            logs.length === params.limit
              ? PaginationStatus.PAGINATION
              : PaginationStatus.NO_PAGINATION,
        };
      } else {
        logger.info("No logs found or query returned an error");
        return {
          logs: [],
          pageCursorOrIndicator: undefined,
        };
      }
    } catch (error) {
      let errorMessage = "Unknown error";

      if (axios.isAxiosError(error)) {
        if (error.response?.data) {
          const errorData = error.response.data as GrafanaErrorResponse;
          errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
        } else {
          errorMessage = error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      logger.error(`Error executing Loki query: ${String(errorMessage)}`);
      return {
        logs: [],
        pageCursorOrIndicator: undefined,
      };
    }
  }

  fetchTraces(_params: TraceSearchInput): Promise<TracesWithPagination> {
    throw new Error("fetchTraces is not implemented for Grafana client");
  }

  async fetchTraceById(_params: {
    traceId: string;
    start?: string;
    end?: string;
  }): Promise<Trace | null> {
    throw new Error("fetchTraceById is not implemented for Grafana client");
  }

  // TODO: check if you need to destructure attributes same as in DD
  private formatLogs(logsResponse: GrafanaLogsResponse): Log[] {
    if (!logsResponse || !logsResponse.data || !logsResponse.data.result) {
      return [];
    }

    const formattedLogs: Log[] = [];

    for (const streamObj of logsResponse.data.result) {
      const streamLabels = streamObj.stream || {};
      const service = streamLabels[GrafanaDefaultFacetsLogs.SERVICE_NAME] || "N/A";

      for (const [nsTs, rawLine] of streamObj.values || []) {
        let logMessage: string;
        let logTime: string | null = null;
        let parsedJson: Record<string, unknown> | null = null;

        try {
          interface ParsedLog {
            log?: string;
            time?: string;
            level?: string;
            [key: string]: unknown;
          }

          parsedJson = JSON.parse(rawLine) as ParsedLog;
          logMessage = parsedJson.log ? String(parsedJson.log) : rawLine;
          logTime = parsedJson.time ? String(parsedJson.time) : null;
        } catch {
          // Omit unused error variable
          logMessage = rawLine;
          logTime = null;
        }

        let finalTime: string;
        if (logTime) {
          finalTime = logTime;
        } else {
          const seconds = parseInt(nsTs) / 1_000_000_000;
          const date = new Date(seconds * 1000);
          finalTime = date.toISOString();
        }

        // Build metadata from stream labels and any additional parsed fields
        const metadata: Record<string, string> = {
          source: "grafana",
        };

        // Add all stream labels as metadata
        Object.entries(streamLabels).forEach(([key, value]) => {
          if (key !== GrafanaDefaultFacetsLogs.SERVICE_NAME) {
            metadata[key] = value;
          }
        });

        // Add any additional fields from parsed JSON
        if (parsedJson) {
          Object.entries(parsedJson).forEach(([key, value]) => {
            if (!["log", "time", "level", "message"].includes(key) && typeof value === "string") {
              metadata[key] = value;
            }
          });
        }

        // Determine log level
        let level = "info"; // Default level
        if (parsedJson?.level) {
          level = parsedJson.level ? String(parsedJson.level) : "info";
        } else if (logMessage.toLowerCase().includes("error")) {
          level = "error";
        } else if (logMessage.toLowerCase().includes("warn")) {
          level = "warn";
        }

        formattedLogs.push({
          timestamp: finalTime,
          message: logMessage.trim(),
          service,
          level,
          metadata,
        });
      }
    }

    return formattedLogs;
  }

  async fetchLabelsLogs(start: string, end: string): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/loki/api/v1/labels`;
      const params = {
        start: toUnixNano(start),
        end: toUnixNano(end),
      };

      const response = await axios.get<GrafanaLabelsResponse>(url, {
        params,
        auth: {
          username: this.username,
          password: this.password,
        },
      });

      if (response.status === 200 && response.data && response.data.status === "success") {
        return response.data.data || [];
      }

      return [];
    } catch (error) {
      logger.error(`Error fetching all labels: ${String(error)}`);
      return [];
    }
  }
}
