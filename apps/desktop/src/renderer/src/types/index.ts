// Types and interfaces for the application

// Import types from packages instead of redefining them
import {
  AssistantMessage as AgentAssistantMessage,
  ChatMessage as AgentChatMessage,
  AgentStep,
  AgentStreamUpdate,
  UserMessage as AgentUserMessage,
  CodePostprocessingFact,
  CodePostprocessingStep,
  LogPostprocessingFact,
  LogPostprocessingStep,
  LogSearchInput,
  LogSearchInputCore,
  LogSearchStep,
  ReasoningStep,
  TraceSearchInput,
} from "@triage/agent";
import { CodebaseOverview, CodebaseOverviewProgressUpdate } from "@triage/codebase-overviews";
import {
  Log,
  LogsWithPagination,
  ServiceLatency,
  Span,
  SpanError,
  SpansWithPagination,
  Trace,
  TracesWithPagination,
} from "@triage/observability";

// Re-export imported types
export type {
  AgentAssistantMessage,
  AgentChatMessage,
  AgentStep,
  AgentStreamUpdate,
  AgentUserMessage,
  CodebaseOverview,
  CodebaseOverviewProgressUpdate,
  CodePostprocessingFact,
  CodePostprocessingStep,
  Log,
  LogPostprocessingFact,
  LogPostprocessingStep,
  LogSearchInput,
  LogSearchInputCore,
  LogSearchStep,
  LogsWithPagination,
  ReasoningStep,
  ServiceLatency,
  Span,
  SpansWithPagination,
  Trace,
  TracesWithPagination,
};

export { getObservabilityPlatform, IntegrationType } from "@triage/observability";

// Define chat type for chat history
export interface Chat {
  id: number;
  createdAt: Date;
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

// Define UI-enhanced version of Span for the UI components
export interface UISpan {
  id: string;
  service: string;
  operation: string;
  resource: string;
  start: string | Date;
  end: string | Date;
  duration: number;
  children?: UISpan[];
  error?: SpanError;
  tags?: Record<string, string>;
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

export interface CodeSearchPair {
  filepath: string;
  code: string;
}

// Similar to LogSearchPair, but for traces
export interface TraceSearchPair {
  input: TraceSearchInput;
  results: TracesWithPagination | string;
}

// Define specific context item types with discriminated union
export interface LogSearchContextItem {
  id: string;
  type: "logSearch";
  title: string;
  description: string;
  data: LogSearchPair;
}

// Context item type for single trace
export interface SingleTraceContextItem {
  id: string;
  type: "singleTrace";
  title: string;
  description: string;
  data: TraceForAgent; // Use the new TraceForAgent type
}

// Context item type as a discriminated union
export type ContextItem = LogSearchContextItem | SingleTraceContextItem;

export type AgentStage =
  | LogSearchStage
  | CodeSearchStage
  | ReasoningStage
  | LogPostprocessingStage
  | CodePostprocessingStage;

export interface LogSearchStage {
  type: "logSearch";
  id: string;
  queries: LogSearchPair[];
}

export interface CodeSearchStage {
  type: "codeSearch";
  id: string;
  retrievedCode: CodeSearchPair[];
}

export interface ReasoningStage {
  type: "reasoning";
  id: string;
  content: string;
}

export interface LogPostprocessingStage {
  type: "logPostprocessing";
  id: string;
  facts: LogPostprocessingFact[];
}

export interface CodePostprocessingStage {
  type: "codePostprocessing";
  id: string;
  facts: CodePostprocessingFact[];
}

// Interface for chat messages
export type ChatMessage = UserMessage | AssistantMessage;

export interface UserMessage {
  id: string;
  role: "user";
  timestamp: Date;
  content: string;
  contextItems?: ContextItem[];
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  timestamp: Date;
  stages: AgentStage[];
  response: string;
  error?: string;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface TimeRangePreset {
  label: string;
  value: number | string;
}
