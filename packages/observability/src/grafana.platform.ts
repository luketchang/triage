import { logger, renderFacetValues, toUnixNano } from "@triage/common";
import { config } from "@triage/config";
import axios from "axios";
import { ObservabilityPlatform } from "./observability.interface";
import { IntegrationType, Log } from "./types";

export const GRAFANA_LOG_SEARCH_INSTRUCTIONS = `
- Use Grafana LogQL queries to search for logs.
- All log queries must be formulated as valid LogQL Loki queries (i.e. selectors wrapped in curly braces {} followed by keyword searches denoted by "|=" or regex searches denoted by "|~")
- Example LogQL query: {service_name="<service_name>"} |= <keyword> |~ <regex>
- You can inspect multiple services' logs in same query as in this example: {service_name=~"<service1>|<service2>"}
- Every query must include at least one label/selector in the curly braces, empty selectors (e.g., curly braces with no content such as {}) are not allowed
- If you query for log level, use keyword or regex search (e.g. |~ "(?i)error" for searching error logs), DO NOT use "level" tag in the query braces only use keywords
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

export class GrafanaPlatform implements ObservabilityPlatform {
  integrationType: IntegrationType = IntegrationType.GRAFANA;
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor() {
    // Fall back to environment config
    if (!config.grafana.baseUrl || !config.grafana.username || !config.grafana.password) {
      throw new Error("Grafana environment configuration is missing required values");
    }
    this.baseUrl = config.grafana.baseUrl;
    this.username = config.grafana.username;
    this.password = config.grafana.password;
  }

  getSpanSearchQueryInstructions(): string {
    throw new Error("getSpanSearchQueryInstructions is not implemented for Grafana platform");
  }

  getLogSearchQueryInstructions(): string {
    return GRAFANA_LOG_SEARCH_INSTRUCTIONS;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getSpansFacetValues(start: string, end: string): Promise<string> {
    throw new Error("getFacetToFacetValuesMapSpans is not implemented for Grafana platform");
  }

  async getLogsFacetValues(start: string, end: string): Promise<string> {
    const facetMap = await this.getLabelToLabelValuesMapLogs(start, end);
    return renderFacetValues(facetMap);
  }

  private async getLabelToLabelValuesMapLogs(
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
  fetchSpans(params: {
    query: string;
    start: string;
    end: string;
    limit: number;
    pageCursor?: string;
  }): Promise<string> {
    throw new Error("fetchSpans is not implemented for Grafana platform");
  }

  async fetchLogs(params: {
    query: string;
    start: string;
    end: string;
    limit: number;
    pageCursor?: string;
  }): Promise<Log[]> {
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
        return this.formatLogs(response.data);
      } else {
        logger.info("No logs found or query returned an error");
        return [];
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
      return [];
    }
  }

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
        let parsedJson: Record<string, any> | null = null;

        try {
          interface ParsedLog {
            log?: string;
            time?: string;
            level?: string;
            [key: string]: any;
          }

          parsedJson = JSON.parse(rawLine) as ParsedLog;
          logMessage = parsedJson.log || rawLine;
          logTime = parsedJson.time || null;
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
          level = parsedJson.level;
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
