import type { LogsWithPagination } from "@triage/observability";

import type { CodePostprocessingFact, LogPostprocessingFact, LogSearchInputCore } from "./tools";

export interface BaseAgentStep {
  timestamp: Date;
}

export interface LogSearchPair {
  input: LogSearchInputCore;
  results: LogsWithPagination | string;
}

export interface LogSearchStep extends BaseAgentStep, LogSearchPair {
  type: "logSearch";
}

export interface CodeSearchPair {
  filepath: string;
  source: string;
}

export interface CodeSearchStep extends BaseAgentStep, CodeSearchPair {
  type: "codeSearch";
}

export interface ReasoningStep extends BaseAgentStep {
  type: "reasoning";
  content: string;
}

export interface ReviewStep extends BaseAgentStep {
  type: "review";
  content: string;
}

export interface LogPostprocessingStep extends BaseAgentStep {
  type: "logPostprocessing";
  facts: LogPostprocessingFact[];
}

export interface CodePostprocessingStep extends BaseAgentStep {
  type: "codePostprocessing";
  facts: CodePostprocessingFact[];
}

export type AgentStep =
  | LogSearchStep
  | CodeSearchStep
  | ReasoningStep
  | ReviewStep
  | LogPostprocessingStep
  | CodePostprocessingStep;

type StreamingPartial<T extends AgentStep> = Omit<T, "content"> & {
  contentChunk: string;
};

export type AgentStreamingStep =
  | LogSearchStep
  | CodeSearchStep
  | StreamingPartial<ReasoningStep>
  | StreamingPartial<ReviewStep>
  | LogPostprocessingStep
  | CodePostprocessingStep;