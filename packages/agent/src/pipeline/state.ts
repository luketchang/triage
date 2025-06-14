import { LogSearchInput } from "@triage/data-integrations";

import { LLMToolCallError } from "../tools";
import {
  CatRequest,
  CatRequestResult,
  CodePostprocessingFact,
  GrepRequest,
  GrepRequestResult,
  LogPostprocessingFact,
  LogSearchResult,
} from "../types/tools";

export interface BaseToolCall {
  timestamp: Date;
}

export interface BaseAgentStep {
  id: string;
  timestamp: Date;
}

export interface WithResult<T> {
  output: T | LLMToolCallError;
}

export interface LogSearchToolCallWithResult extends BaseToolCall, WithResult<LogSearchResult> {
  type: "logSearch";
  input: LogSearchInput;
}

export interface LogSearchStep extends BaseAgentStep {
  type: "logSearch";
  reasoning: string;
  data: LogSearchToolCallWithResult[];
}

export interface CatToolCallWithResult extends BaseToolCall, WithResult<CatRequestResult> {
  type: "cat";
  input: CatRequest;
}

export interface GrepToolCallWithResult extends BaseToolCall, WithResult<GrepRequestResult> {
  type: "grep";
  input: GrepRequest;
}

export type CodeSearchToolCallWithResult = CatToolCallWithResult | GrepToolCallWithResult;

export interface CodeSearchStep extends BaseAgentStep {
  type: "codeSearch";
  reasoning: string;
  data: CodeSearchToolCallWithResult[];
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

type StreamingChunk<T extends AgentStep> = Omit<T, "data" | "type" | "reasoning"> & {
  type: `${T["type"]}-chunk`;
  chunk: string;
};

type StreamingTools<T extends AgentStep> = Omit<T, "type" | "reasoning"> & {
  type: `${T["type"]}-tools`;
  toolCalls: T["data"];
};

export type AgentStreamUpdate =
  | StreamingChunk<ReasoningStep>
  | StreamingChunk<LogSearchStep>
  | StreamingChunk<CodeSearchStep>
  | StreamingTools<LogSearchStep>
  | StreamingTools<CodeSearchStep>
  | LogPostprocessingStep
  | CodePostprocessingStep;

export type StreamUpdateFn = (update: AgentStreamUpdate) => void;

export enum StepsType {
  CURRENT = "current",
  PREVIOUS = "previous",
  BOTH = "both",
}
