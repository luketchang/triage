export enum PaginationStatus {
  PAGINATION = "More pages available",
  NO_PAGINATION = "End of pagination",
}

export enum IntegrationType {
  DATADOG = "datadog",
  GRAFANA = "grafana",
}

export interface Log {
  timestamp: string;
  message: string;
  service: string;
  level: string;
  attributes?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  metadata: Record<string, string>;
}

export interface LogsWithPagination {
  logs: Log[];
  pageCursorOrIndicator?: string; // NOTE: hacky but in case of platform that doesn't support pagination, we'll just use this to communicate whether or not there are more results
}

export interface SpansWithPagination {
  spans: Span[];
  pageCursorOrIndicator?: string; // Similar to LogsWithPagination, to support pagination for spans
}

export interface Span {
  spanId: string;
  traceId: string;
  service: string;
  operation: string;
  startTime: string | number;
  endTime: string | number;
  duration: number;
  status?: string;
  environment?: string;
  metadata: Record<string, string>;
}
