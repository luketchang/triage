// Types and interfaces for the application

// Import types from packages instead of redefining them
import {
  AgentResult,
  AgentStreamUpdate,
  LogSearchInput,
  LogSearchInputCore,
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
  AgentResult,
  IntegrationType,
  Log,
  LogSearchInput,
  LogSearchInputCore,
  LogsWithPagination,
  ServiceLatency,
  Span,
  SpansWithPagination,
  AgentStreamUpdate as StreamUpdate,
  Trace,
  TracesWithPagination,
};

// Define the types for the new streaming architecture
export type AgentStepType =
  | "logSearch"
  | "reasoning"
  | "review"
  | "logPostprocessing"
  | "codePostprocessing";

// Base interface for agent steps
export interface BaseAgentStep {
  id: string;
  type: AgentStepType;
}

// Log search step interface
export interface LogSearchStep extends BaseAgentStep {
  type: "logSearch";
  searches: string[];
}

// Reasoning step interface
export interface ReasoningStep extends BaseAgentStep {
  type: "reasoning";
  content: string;
}

// Review step interface
export interface ReviewStep extends BaseAgentStep {
  type: "review";
  content: string;
}

// Log postprocessing step interface
export interface LogPostprocessingStep extends BaseAgentStep {
  type: "logPostprocessing";
  content: string;
}

// Code postprocessing step interface
export interface CodePostprocessingStep extends BaseAgentStep {
  type: "codePostprocessing";
  content: string;
}

// Union type for all agent steps
export type AgentStep =
  | LogSearchStep
  | ReasoningStep
  | ReviewStep
  | LogPostprocessingStep
  | CodePostprocessingStep;

// Cell interface represents a single agent invocation/response
export interface Cell {
  id: string;
  steps: AgentStep[];
  response: string;
  error?: string;
  artifacts?: Artifact[];
  logPostprocessing?: LogPostprocessing | null;
  codePostprocessing?: CodePostprocessing | null;
}

// Define code map type alias
export type CodeMap = Map<string, string>;

// Enhanced CodeMap with repository and file path information
export interface EnhancedCodeMap extends CodeMap {
  repoPath?: string;
  filePath?: string;
}

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

// Define file tree node structure
export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

// Define flattened file node for TreeView component
export interface FlattenedFileNode {
  id: number;
  name: string;
  path: string;
  parent: number | null;
  children: number[];
  isDirectory: boolean;
  level: number;
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
  data: EnhancedCodeMap;
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

// Log postprocessing types
export interface LogPostprocessingFact {
  title: string;
  fact: string;
  query: string;
  start: string;
  end: string;
  limit: number;
  pageCursor: string | null;
  type: "logSearchInput";
}

export interface LogPostprocessing {
  facts: LogPostprocessingFact[];
}

// Code postprocessing types
export interface CodePostprocessingFact {
  title: string;
  fact: string;
  filepath: string;
  codeBlock: string;
}

export interface CodePostprocessing {
  facts: CodePostprocessingFact[];
}

// Interface for chat messages
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifacts?: Artifact[];
  contextItems?: ContextItem[];
  logPostprocessing: LogPostprocessing | null;
  codePostprocessing: CodePostprocessing | null;
  cell?: Cell; // Reference to the Cell for assistant messages
}

// Interface for main content tabs
export type TabType = "logs" | "traces" | "dashboards" | "chat";

export interface TimeRange {
  start: string;
  end: string;
}

export interface TimeRangePreset {
  label: string;
  value: number | string;
}

// Define PostprocessedLogSearchInput locally since it's not exported by @triage/agent
export interface PostprocessedLogSearchInput extends LogSearchInputCore {
  title?: string;
  reasoning?: string;
  summary?: string;
}

// Interface for chat API responses
export interface ChatResponse {
  success: boolean;
  content: string;
  logContext?: Map<LogSearchInputCore, LogsWithPagination | string>;
  codeContext?: Map<string, string>;
  logPostprocessing: LogPostprocessing | null;
  codePostprocessing: CodePostprocessing | null;
}
