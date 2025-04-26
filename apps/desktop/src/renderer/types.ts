// Import types from packages
import { LogSearchInputCore, PostprocessedLogSearchInput } from "@triage/agent";
import {
  Log,
  LogsWithPagination,
  Span,
  SpansWithPagination,
  Trace,
  TracesWithPagination,
} from "@triage/observability";

// Re-export imported types
export type {
  Log,
  LogSearchInputCore,
  LogsWithPagination,
  PostprocessedLogSearchInput,
  Span,
  SpansWithPagination,
  Trace,
  TracesWithPagination,
};

// Define missing types referenced in api.ts and electronApiMock.ts
export interface AgentConfig {
  repoPath: string;
  codebaseOverviewPath: string;
  observabilityPlatform: string;
  observabilityFeatures: string[];
  startDate: Date;
  endDate: Date;
}

export interface FacetData {
  name: string;
  values: string[];
  counts: number[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

export interface LogQueryParams {
  query: string;
  start: string;
  end: string;
  limit: number;
  pageCursor?: string | null;
}

export interface TraceQueryParams {
  query: string;
  start: string;
  end: string;
  limit: number;
  pageCursor?: string | null;
}
