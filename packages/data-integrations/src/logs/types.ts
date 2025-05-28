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
  pageCursorOrIndicator?: string; // NOTE: hacky but in case of client that doesn't support pagination, we'll just use this to communicate whether or not there are more results
}

export interface LogSearchInput {
  type: "logSearchInput";
  start: string;
  end: string;
  query: string;
  limit: number;
  pageCursor?: string;
}
