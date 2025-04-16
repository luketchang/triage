// Types and interfaces for the application

// Import types from packages instead of redefining them
import {
  LogSearchInput,
  LogSearchInputCore,
  PostprocessedLogSearchInput,
  TraceSearchInput,
} from "@triage/agent";

import {
  IntegrationType,
  Log,
  LogsWithPagination,
  ServiceLatency,
  Span,
  SpansWithPagination,
  Trace,
  TracesWithPagination,
} from "@triage/observability";

// Re-export imported types
export type {
  IntegrationType,
  Log,
  LogSearchInput,
  LogSearchInputCore,
  LogsWithPagination,
  PostprocessedLogSearchInput,
  ServiceLatency,
  Span,
  SpansWithPagination,
  Trace,
  TracesWithPagination,
};

// Define code map type alias
export type CodeMap = Map<string, string>;

// Define UI-enhanced versions of observability types with visual properties
// These will supplement the data-only types from the observability package
export interface UIServiceLatency extends ServiceLatency {
  color: string; // for visualization
}

// Define a UI-enhanced version of Trace with visual properties
export interface UITrace extends Omit<Trace, "serviceBreakdown"> {
  serviceBreakdown: UIServiceLatency[]; // Override with UI-enhanced service latency
}

// Define a version of Trace for agent consumption without serviceBreakdown
export type TraceForAgent = Omit<Trace, "serviceBreakdown">;

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

// Similar to LogQueryParams, but for traces
export interface TraceQueryParams {
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

// Similar to LogSearchPair, but for traces
export interface TraceSearchPair {
  input: TraceSearchInput;
  results: TracesWithPagination | string;
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

export interface TraceArtifact {
  id: string;
  type: "trace";
  title: string;
  description: string;
  data: TraceSearchPair;
}

// Artifact type as a discriminated union
export type Artifact = LogArtifact | CodeArtifact | TraceArtifact;

// Define specific context item types with discriminated union
export interface LogSearchContextItem {
  id: string;
  type: "logSearch";
  title: string;
  description: string;
  data: LogSearchPair;
  sourceTab: TabType;
}

// Context item type for single trace
export interface SingleTraceContextItem {
  id: string;
  type: "singleTrace";
  title: string;
  description: string;
  data: TraceForAgent; // Use the new TraceForAgent type
  sourceTab: TabType;
}

// Context item type as a discriminated union
export type ContextItem = LogSearchContextItem | SingleTraceContextItem;

// Interface for chat messages
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifacts?: Artifact[];
  contextItems?: ContextItem[];
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
