import { LogSearchAgentResponse } from "../nodes/log-search";
import {
  CatRequest,
  CatRequestResult,
  GrepRequest,
  GrepRequestResult,
  LogRequest,
  LogSearchInput,
  LogSearchResult,
} from "../types";

type ToolCallID = {
  toolCallId: string;
};

// TODO: remove LogRequest, wrong level of abstraction
export type LLMToolCall = ToolCallID & (LogRequest | LogSearchInput | CatRequest | GrepRequest);

export type SubAgentCall = ToolCallID & LogRequest;

// TODO: remove LogSearchAgentResponse, wrong level of abstraction
export type LLMToolCallResult =
  | LogSearchAgentResponse
  | LogSearchResult
  | CatRequestResult
  | GrepRequestResult;

export type LLMToolCallError = { error: string };

export type LLMToolCallResultOrError = LLMToolCallResult | LLMToolCallError;
