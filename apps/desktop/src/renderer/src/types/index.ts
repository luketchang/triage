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
  CodeSearchStep,
  LogPostprocessingFact,
  LogPostprocessingStep,
  LogSearchInput,
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
  CodeSearchStep,
  Log,
  LogPostprocessingFact,
  LogPostprocessingStep,
  LogSearchInput,
  LogSearchStep,
  LogsWithPagination,
  ReasoningStep,
  ServiceLatency,
  Span,
  SpansWithPagination,
  Trace,
  TraceSearchInput,
  TracesWithPagination,
};

export { getObservabilityPlatform, IntegrationType } from "@triage/observability";

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

export interface UserMessage {
  id: string;
  role: "user";
  timestamp: Date;
  content: string;
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
