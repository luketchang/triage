import type { LogsWithPagination } from "@triage/observability";
import type { CodePostprocessingFact, LogPostprocessingFact, LogSearchInputCore } from "./tools";

export type AgentStepType =
  | "logSearch"
  | "spanSearch"
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
  step: AgentStep;
};

export type AgentStep =
  | LogSearchStep
  | ReasoningStep
  | ReviewStep
  | LogPostprocessingStep
  | CodePostprocessingStep;

export interface BaseAgentStep {
  type: AgentStepType;
  timestamp: Date;
}

export interface LogSearchStep extends BaseAgentStep {
  type: "logSearch";
  input: LogSearchInputCore;
  result: LogsWithPagination | string;
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
