import { CodeSearchAgentResponse } from "../nodes/code-search";
import { LogSearchAgentResponse } from "../nodes/log-search";
import {
  CatRequest,
  CatRequestResult,
  CodeRequest,
  GrepRequest,
  GrepRequestResult,
  LogRequest,
  LogSearchInput,
  LogSearchResult,
} from "../types";

type ToolCallID = {
  toolCallId: string;
};

export type LLMToolCall = ToolCallID & (LogSearchInput | CatRequest | GrepRequest);

export type SubAgentCall = ToolCallID & (LogRequest | CodeRequest);

export type LLMToolCallResult = LogSearchResult | CatRequestResult | GrepRequestResult;

export type SubAgentCallResult = LogSearchAgentResponse | CodeSearchAgentResponse;

export type LLMToolCallError = { error: string };

export type LLMToolCallResultOrError = LLMToolCallResult | LLMToolCallError;
