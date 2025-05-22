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

// Trace-related interfaces
export interface SpanError {
  message: string;
  type: string;
  stack?: string;
}

export interface DisplaySpan {
  id: string;
  parentId?: string;
  service: string;
  operation: string;
  resource: string;
  start: Date;
  end: Date;
  duration: number; // in milliseconds
  status?: string;
  tags: Record<string, string>;
  children: DisplaySpan[];
  level: number; // for display indentation
  error?: SpanError;
}

export interface ServiceLatency {
  service: string;
  duration: number;
  percentage: number; // percentage of total trace duration
}

export interface DisplayTrace {
  traceId: string;
  rootSpan: DisplaySpan;
  spans: DisplaySpan[];
  startTime: Date;
  endTime: Date;
  totalDuration: number;
}

export interface Trace {
  traceId: string;
  rootService: string;
  rootLatencyPercentile?: string;
  rootOperation: string;
  rootResource: string;
  httpStatus?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  serviceBreakdown: ServiceLatency[];
  hasError: boolean;
  displayTrace: DisplayTrace;
}

export interface TracesWithPagination {
  traces: Trace[];
  pageCursorOrIndicator?: string;
}

export interface LogSearchInput {
  type: "logSearchInput";
  start: string;
  end: string;
  query: string;
  limit: number;
  pageCursor?: string;
}

export interface SpanSearchInput {
  type: "spanSearchInput";
  query: string;
  start: string;
  end: string;
  limit: number;
  pageCursor?: string;
}

export interface TraceSearchInput {
  type: "traceSearchInput";
  start: string;
  end: string;
  query: string;
  limit: number;
  pageCursor?: string;
}
