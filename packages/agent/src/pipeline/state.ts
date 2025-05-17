import { LLMToolCallError } from "../tools";
import {
  CatRequest,
  CatRequestResult,
  CodePostprocessingFact,
  GrepRequest,
  GrepRequestResult,
  LogPostprocessingFact,
  LogSearchInput,
  LogSearchResult,
} from "../types/tools";

// TODO: MOVE EVERYTHING TO TYPES
export interface BaseToolCall {
  timestamp: Date;
}

export interface BaseAgentStep {
  id: string;
  timestamp: Date;
}

export interface LogSearchToolCall extends BaseToolCall {
  type: "logSearch";
  input: LogSearchInput;
  output: LogSearchResult | LLMToolCallError;
}

export interface LogSearchStep extends BaseAgentStep {
  type: "logSearch";
  reasoning: string;
  data: LogSearchToolCall[];
}

// TODO: RENAME TO TOOLCALLWITHRESULT
export interface CatToolCall extends BaseToolCall {
  type: "cat";
  input: CatRequest;
  output: CatRequestResult | LLMToolCallError;
}

export interface GrepToolCall extends BaseToolCall {
  type: "grep";
  input: GrepRequest;
  output: GrepRequestResult | LLMToolCallError;
}

export type CodeSearchToolCall = CatToolCall | GrepToolCall;

export interface CodeSearchStep extends BaseAgentStep {
  type: "codeSearch";
  reasoning: string;
  data: CodeSearchToolCall[];
}

export interface ReasoningStep extends BaseAgentStep {
  type: "reasoning";
  data: string;
}

export interface LogPostprocessingStep extends BaseAgentStep {
  type: "logPostprocessing";
  data: LogPostprocessingFact[];
}

export interface CodePostprocessingStep extends BaseAgentStep {
  type: "codePostprocessing";
  data: CodePostprocessingFact[];
}

export type AgentStep =
  | LogSearchStep
  | CodeSearchStep
  | ReasoningStep
  | LogPostprocessingStep
  | CodePostprocessingStep;

export type AgentStage =
  | "logSearch"
  | "codeSearch"
  | "reasoning"
  | "logPostprocessing"
  | "codePostprocessing";

type StreamingPartial<T> = Omit<T, "data"> & { chunk: string };

export type AgentStreamingStep =
  | LogSearchStep
  | CodeSearchStep
  | StreamingPartial<ReasoningStep>
  | LogPostprocessingStep
  | CodePostprocessingStep;

export type AgentStreamUpdate = {
  type: "intermediateUpdate";
  step: AgentStreamingStep;
};

export type StreamUpdateFn = (update: AgentStreamUpdate) => void;

export enum StepsType {
  CURRENT = "current",
  PREVIOUS = "previous",
  BOTH = "both",
}
