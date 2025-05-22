// Types and interfaces for the application

// Import types from packages instead of redefining them
import {
  AssistantMessage as AgentAssistantMessage,
  ChatMessage as AgentChatMessage,
  AgentStep,
  AgentStreamUpdate,
  UserMessage as AgentUserMessage,
  CatToolCallWithResult,
  CodePostprocessingFact,
  CodePostprocessingStep,
  CodeSearchStep,
  GrepToolCallWithResult,
  LogPostprocessingFact,
  LogPostprocessingStep,
  LogSearchStep,
  LogSearchToolCallWithResult,
  ReasoningStep,
} from "@triage/agent";
import { CodebaseOverview, CodebaseOverviewProgressUpdate } from "@triage/codebase-overviews";
import {
  GetSentryEventInput,
  Log,
  LogSearchInput,
  LogsWithPagination,
  SentryEvent,
  SentryEventSpecifier,
  ServiceLatency,
  Span,
  SpansWithPagination,
  Trace,
  TraceSearchInput,
  TracesWithPagination,
} from "@triage/data-integrations";

// Re-export imported types
export type {
  AgentAssistantMessage,
  AgentChatMessage,
  AgentStep,
  AgentStreamUpdate,
  AgentUserMessage,
  CatToolCallWithResult,
  CodebaseOverview,
  CodebaseOverviewProgressUpdate,
  CodePostprocessingFact,
  CodePostprocessingStep,
  CodeSearchStep,
  GetSentryEventInput,
  GrepToolCallWithResult,
  Log,
  LogPostprocessingFact,
  LogPostprocessingStep,
  LogSearchInput,
  LogSearchStep,
  LogSearchToolCallWithResult,
  LogsWithPagination,
  ReasoningStep,
  SentryEvent,
  SentryEventSpecifier,
  ServiceLatency,
  Span,
  SpansWithPagination,
  Trace,
  TraceSearchInput,
  TracesWithPagination,
};

export { getObservabilityClient, IntegrationType } from "@triage/data-integrations";

// Define chat type for chat history
export interface Chat {
  id: number;
  createdAt: Date;
}

// Define facet data type
export interface FacetData {
  name: string;
  values: string[];
  counts?: number[];
}

// Interface for chat messages
export type ChatMessage = UserMessage | AssistantMessage;

export type ContextItem = LogSearchInput | GetSentryEventInput;

export type MaterializedContextItem = LogsWithPagination | SentryEvent;

export interface UserMessage {
  id: string;
  role: "user";
  timestamp: Date;
  content: string;
  contextItems?: Map<ContextItem, MaterializedContextItem>;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  timestamp: Date;
  steps: AgentStep[];
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
