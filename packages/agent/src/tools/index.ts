import { exec } from "child_process";

import { logger } from "@triage/common";
import { ObservabilityPlatform } from "@triage/observability";

import { CodeSearchAgentResponse } from "../nodes/code-search";
import { LogSearchAgentResponse } from "../nodes/log-search";
// import { AgentStep } from "../pipeline/state";
import {
  CatRequest,
  CatRequestResult,
  CodeRequest,
  GrepRequest,
  GrepRequestResult,
  LogRequest,
  LogSearchInput,
  LogSearchInputCore,
  LogSearchResult,
} from "../types";

type ToolCallID = {
  toolCallId: string;
};

export type LLMToolCall = ToolCallID & (LogSearchInput | CatRequest | GrepRequest);

export type SubAgentCall = ToolCallID & (LogRequest | CodeRequest);

export type LLMToolCallResult = LogSearchResult | CatRequestResult | GrepRequestResult;

export type SubAgentCallResult = LogSearchAgentResponse | CodeSearchAgentResponse;

export type LLMToolCallError = { type: "error"; toolCallType: LLMToolCall["type"]; error: string };

export type LLMToolCallResultOrError = LLMToolCallResult | LLMToolCallError;

export async function handleCatRequest(
  toolCall: CatRequest
): Promise<CatRequestResult | LLMToolCallError> {
  return new Promise((resolve, _) => {
    exec(`cat ${toolCall.path}`, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Error reading file ${toolCall.path}: ${error} \n ${stderr}`);
        resolve({ type: "error", toolCallType: "catRequest", error: error.message });
      } else {
        resolve({ type: "result", content: stdout, toolCallType: "catRequest" });
      }
    });
  });
}

export async function handleGrepRequest(
  toolCall: GrepRequest
): Promise<GrepRequestResult | LLMToolCallError> {
  return new Promise((resolve) => {
    // Escape or quote inputs to reduce shell injection risk
    const flags = toolCall.flags ? `-${toolCall.flags}` : "";
    const pattern = `"${toolCall.pattern.replace(/"/g, '\\"')}"`;
    const file = `"${toolCall.file.replace(/"/g, '\\"')}"`;

    exec(`grep ${flags} ${pattern} ${file}`, (error, stdout, stderr) => {
      if (error && typeof error.code === "number" && error.code > 1) {
        logger.error(`Error grepping file ${toolCall.file}: ${error} \n ${stderr}`);
        resolve({ type: "error", toolCallType: "grepRequest", error: error.message });
      } else if (error && error.code === 1) {
        // No matches found
        resolve({ type: "result", content: "No matches found", toolCallType: "grepRequest" });
      } else {
        // Matches found
        resolve({ type: "result", content: stdout, toolCallType: "grepRequest" });
      }
    });
  });
}
export async function handleLogSearchRequest(
  toolCall: LogSearchInputCore,
  observabilityPlatform: ObservabilityPlatform
): Promise<LogSearchResult | LLMToolCallError> {
  try {
    const logContext = await observabilityPlatform.fetchLogs({
      query: toolCall.query,
      start: toolCall.start,
      end: toolCall.end,
      limit: toolCall.limit,
    });
    return { type: "result", toolCallType: "logSearchInput", ...logContext };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error searching logs: ${err}`);
    return {
      type: "error",
      toolCallType: "logSearchInput",
      error: err.message,
    };
  }
}
