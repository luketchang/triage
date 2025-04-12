// Types and interfaces for the application

// Import types from packages instead of redefining them
import { LogSearchInput, LogSearchInputCore, PostprocessedLogSearchInput } from "@triage/agent";

import {
  IntegrationType,
  Log,
  LogsWithPagination,
  Span,
  SpansWithPagination,
} from "@triage/observability";

// Re-export imported types
export type {
  IntegrationType,
  Log,
  LogSearchInput,
  LogSearchInputCore,
  LogsWithPagination,
  PostprocessedLogSearchInput,
  Span,
  SpansWithPagination,
};

// Define code map type alias
export type CodeMap = Map<string, string>;

// Define the AgentConfig interface - specific to desktop app
export interface AgentConfig {
  repoPath: string;
  codebaseOverviewPath: string;
  observabilityPlatform: string;
  observabilityFeatures: string[];
  startDate: Date;
  endDate: Date;
}

// Define facet data type
export interface FacetData {
  name: string;
  values: string[];
  counts?: number[];
}

// Define log query params type
export interface LogQueryParams {
  query: string;
  start: string;
  end: string;
  limit: number;
  pageCursor?: string;
}

// Define LogSearchPair type for storing pairs of search inputs and results
export interface LogSearchPair {
  input: LogSearchInputCore;
  results: LogsWithPagination | string;
}

// Define specific artifact types with discriminated union
export interface LogArtifact {
  id: string;
  type: "log";
  title: string;
  description: string;
  data: LogSearchPair;
}

export interface CodeArtifact {
  id: string;
  type: "code";
  title: string;
  description: string;
  data: CodeMap;
}

// Artifact type as a discriminated union
export type Artifact = LogArtifact | CodeArtifact;

// Define specific context item types with discriminated union
export interface LogSearchContextItem {
  id: string;
  type: "logSearch";
  title: string;
  description: string;
  data: LogSearchPair;
  sourceTab: TabType;
}

// Context item type as a discriminated union (currently only has LogSearchContextItem)
export type ContextItem = LogSearchContextItem;

// Interface for chat messages
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifacts?: Artifact[];
}

// Interface for main content tabs
export type TabType = "logs" | "traces" | "dashboards" | "code";

export interface TimeRange {
  start: string;
  end: string;
}

export interface TimeRangePreset {
  label: string;
  value: number | string;
}
