import type { LogsWithPagination } from "@triage/observability";
import type { CodePostprocessingFact, LogPostprocessingFact, LogSearchInputCore } from "./tools";

export type AgentStepType =
  | "logSearch"
  | "codeSearch"
  | "reasoning"
  | "review"
  | "logPostprocessing"
  | "codePostprocessing";

export type AgentStreamUpdate = HighLevelUpdate | IntermediateUpdate;

export type HighLevelUpdate = {
  type: "highLevelUpdate";
  stepType: AgentStepType;
  id: string;
};

export type IntermediateUpdate = {
  type: "intermediateUpdate";
  id: string;
  parentId: string;
  step: AgentStreamingStep;
};

export type AgentStep =
  | LogSearchStep
  | CodeSearchStep
  | ReasoningStep
  | ReviewStep
  | LogPostprocessingStep
  | CodePostprocessingStep;

export type AgentStreamingStep =
  | LogSearchStep
  | CodeSearchStep
  | ReasoningPartialStep
  | ReviewPartialStep
  | LogPostprocessingStep
  | CodePostprocessingStep;

export interface BaseAgentStep {
  type: AgentStepType;
  timestamp: Date;
}

export interface LogSearchPair {
  input: LogSearchInputCore;
  results: LogsWithPagination | string;
}

export interface CodeSearchPair {
  filepath: string;
  source: string;
}

export interface LogSearchStep extends BaseAgentStep, LogSearchPair {
  type: "logSearch";
}

export interface CodeSearchStep extends BaseAgentStep, CodeSearchPair {
  type: "codeSearch";
}

export interface ReasoningStep extends BaseAgentStep {
  type: "reasoning";
  content: string;
}

export type ReasoningPartialStep = Omit<ReasoningStep, "content"> & {
  contentChunk: string;
};

export interface ReviewStep extends BaseAgentStep {
  type: "review";
  content: string;
}

export type ReviewPartialStep = Omit<ReviewStep, "content"> & {
  contentChunk: string;
};

export interface LogPostprocessingStep extends BaseAgentStep {
  type: "logPostprocessing";
  facts: LogPostprocessingFact[];
}

export interface CodePostprocessingStep extends BaseAgentStep {
  type: "codePostprocessing";
  facts: CodePostprocessingFact[];
}

export interface AssistantMessage {
  role: "assistant";
  steps: AgentStep[];
  response: string | null;
  error: string | null;
}

export interface UserMessage {
  role: "user";
  content: string;
}

export type ChatMessage = UserMessage | AssistantMessage;
