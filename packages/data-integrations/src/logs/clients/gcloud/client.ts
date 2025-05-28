import { logger } from "@triage/common";
import axios from "axios";

import { GcloudConfig } from "../../../config";
import { IntegrationType } from "../../../shared";
import { LogsClient } from "../../logs.interface";
import { Log, LogSearchInput, LogsWithPagination } from "../../types";

const GCLOUD_LOG_SEARCH_INSTRUCTIONS = `
## Google Cloud Logging Query Syntax
- Use Google Cloud Logging query language to search for logs.
- Queries are case-sensitive.

## Example queries:
  - resource.type="gce_instance"
  - resource.type="k8s_container" AND resource.labels.namespace_name="default"
  - severity>=ERROR
  - logName="projects/my-project/logs/syslog" AND textPayload:"error"

## Rules
- Use AND, OR, and NOT for boolean operations
- Use quotes for exact phrase matching: textPayload:"exact phrase"
- Use comparison operators: =, !=, >, <, >=, <=
- Use regular expressions with =~: textPayload=~"error.*timeout"

## Best practices (examples):
- GOOD: resource.type="k8s_container" AND severity>=ERROR
- GOOD: resource.type="gce_instance" AND (textPayload:"error" OR textPayload:"exception")
- GOOD: logName="projects/my-project/logs/syslog" AND labels.environment="production"
- BAD: resource.type (missing operator and value)
- BAD: "error" (missing field specifier)

## Pagination
- Google Cloud Logging uses nextPageToken for pagination
- Include the nextPageToken from the previous response in your next request as pageToken
`;

const GCLOUD_DEFAULT_FACET_LIST = ["resource.type", "severity"];

interface GcloudLogEntry {
  insertId?: string;
  logName?: string;
  timestamp?: string;
  textPayload?: string;
  jsonPayload?: Record<string, unknown>;
  severity?: string;
  resource?: {
    type?: string;
    labels?: Record<string, string>;
  };
  labels?: Record<string, string>;
  [key: string]: unknown;
}

interface GcloudLogsResponse {
  entries: GcloudLogEntry[];
  nextPageToken?: string;
}

export class GcloudLogsClient implements LogsClient {
  integrationType: IntegrationType = IntegrationType.GCLOUD;
  private authToken: string;
  private projectId: string;
  private baseUrl = "https://logging.googleapis.com/v2";

  constructor(cfg: GcloudConfig) {
    this.authToken = cfg.authToken as string;
    this.projectId = cfg.projectId as string;
  }

  getLogSearchQueryInstructions(): string {
    return GCLOUD_LOG_SEARCH_INSTRUCTIONS;
  }

  addKeywordsToQuery(query: string, keywords: string[]): string {
    if (!keywords || keywords.length === 0) {
      return query;
    }

    const escapedKeywords = keywords.map((kw) => kw.replace(/"/g, '\\"'));

    const keywordClauses = escapedKeywords.map((kw) => `(textPayload:"${kw}" OR jsonPayload:"${kw}")`);
    const keywordClause = keywordClauses.join(" OR ");

    const formattedKeywords = escapedKeywords.length > 1 ? `(${keywordClause})` : keywordClause;

    if (!query || query.trim() === "") {
      return formattedKeywords;
    }

    return `${query} AND ${formattedKeywords}`;
  }

  async getLogsFacetValues(
    start: string,
    end: string,
    facetList: string[] = GCLOUD_DEFAULT_FACET_LIST
  ): Promise<Map<string, string[]>> {
    const facetMap = new Map<string, Set<string>>();
    
    try {
      for (const facet of facetList) {
        facetMap.set(facet, new Set<string>());
      }

      const response = await this.fetchLogsForFacets(start, end, 1000);
      
      for (const log of response.logs) {
        for (const facet of facetList) {
          if (facet.includes('.')) {
            const parts = facet.split('.');
            const parent = parts[0];
            const child = parts[1];
            if (log.metadata[facet]) {
              facetMap.get(facet)?.add(log.metadata[facet]);
            } else if (parent && child && log.metadata[parent] && typeof log.metadata[parent] === 'string') {
              try {
                const parentObj = JSON.parse(log.metadata[parent]);
                if (parentObj && typeof parentObj === 'object' && child in parentObj) {
                  facetMap.get(facet)?.add(String(parentObj[child as keyof typeof parentObj]));
                }
              } catch {
              }
            }
          } else if (log.metadata[facet]) {
            facetMap.get(facet)?.add(log.metadata[facet]);
          }
        }
      }

      const result = new Map<string, string[]>();
      for (const [facet, values] of facetMap.entries()) {
        result.set(facet, Array.from(values));
      }
      
      return result;
    } catch (error) {
      logger.error(`Error fetching facet values: ${String(error)}`);
      return new Map<string, string[]>();
    }
  }

  private async fetchLogsForFacets(
    start: string, 
    end: string, 
    limit: number
  ): Promise<LogsWithPagination> {
    return this.fetchLogs({
      type: "logSearchInput",
      start,
      end,
      query: "",
      limit,
    });
  }

  async fetchLogs(params: LogSearchInput): Promise<LogsWithPagination> {
    try {
      const url = `${this.baseUrl}/entries:list`;
      
      logger.info(`Executing Google Cloud Logging query: ${params.query}`);
      logger.info(`Time range: ${params.start} to ${params.end}`);
      logger.info(`Limit: ${params.limit}`);
      logger.info(`Page token: ${params.pageCursor || 'none'}`);

      const requestBody = {
        resourceNames: [`projects/${this.projectId}`],
        filter: params.query,
        orderBy: "timestamp desc",
        pageSize: params.limit,
        pageToken: params.pageCursor,
      };

      if (params.start && params.end) {
        const timeFilter = `timestamp >= "${params.start}" AND timestamp <= "${params.end}"`;
        requestBody.filter = requestBody.filter 
          ? `${requestBody.filter} AND ${timeFilter}` 
          : timeFilter;
      }

      const response = await axios.post<GcloudLogsResponse>(url, requestBody, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      });

      if (response.status === 200 && response.data && response.data.entries) {
        logger.info(`Found ${response.data.entries.length} logs`);
        const logs = this.formatLogs(response.data.entries);
        return {
          logs,
          pageCursorOrIndicator: response.data.nextPageToken,
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
          errorMessage = JSON.stringify(error.response.data);
        } else {
          errorMessage = error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      logger.error(`Error executing Google Cloud Logging query: ${errorMessage}`);
      return {
        logs: [],
        pageCursorOrIndicator: undefined,
      };
    }
  }

  private formatLogs(logEntries: GcloudLogEntry[]): Log[] {
    if (!logEntries || logEntries.length === 0) {
      return [];
    }

    return logEntries.map((entry) => {
      let serviceName = "N/A";
      if (entry.resource?.type) {
        serviceName = entry.resource.type;
      } else if (entry.logName) {
        const logNameParts = entry.logName.split('/');
        if (logNameParts.length > 0) {
          serviceName = logNameParts[logNameParts.length - 1] || "unknown";
        }
      }

      const timestamp = entry.timestamp 
        ? new Date(entry.timestamp).toISOString() 
        : new Date().toISOString();

      let content = "N/A";
      if (entry.textPayload) {
        content = entry.textPayload;
      } else if (entry.jsonPayload) {
        try {
          if (typeof entry.jsonPayload.message === 'string') {
            content = entry.jsonPayload.message;
          } else {
            content = JSON.stringify(entry.jsonPayload);
          }
        } catch {
          content = "Error parsing JSON payload";
        }
      }

      let level = "info";
      if (entry.severity) {
        const severityMap: Record<string, string> = {
          "DEBUG": "debug",
          "INFO": "info",
          "NOTICE": "info",
          "WARNING": "warn",
          "ERROR": "error",
          "CRITICAL": "error",
          "ALERT": "error",
          "EMERGENCY": "error",
        };
        level = severityMap[entry.severity] || "info";
      }

      const metadata: Record<string, string> = {
        source: "gcloud",
      };

      if (entry.resource) {
        metadata["resource.type"] = entry.resource.type || "unknown";
        
        if (entry.resource.labels) {
          Object.entries(entry.resource.labels).forEach(([key, value]) => {
            metadata[`resource.labels.${key}`] = value;
          });
        }
      }

      if (entry.labels) {
        Object.entries(entry.labels).forEach(([key, value]) => {
          metadata[`labels.${key}`] = value;
        });
      }

      if (entry.insertId) {
        metadata["insertId"] = entry.insertId;
      }

      if (entry.logName) {
        metadata["logName"] = entry.logName;
      }

      let attributes;
      if (entry.jsonPayload) {
        attributes = entry.jsonPayload;
      }

      return {
        timestamp,
        message: content,
        service: serviceName,
        level,
        attributes,
        metadata,
      };
    });
  }
}
