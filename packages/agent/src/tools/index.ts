import { exec } from "child_process";

import { logger } from "@triage/common";
import { ObservabilityPlatform } from "@triage/observability";

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

export type LLMToolCallError = { type: "error"; error: string };

export type LLMToolCallResultOrError = LLMToolCallResult | LLMToolCallError;

export async function handleCatRequest(
  toolCall: CatRequest
): Promise<CatRequestResult | LLMToolCallError> {
  return new Promise((resolve, _) => {
    exec(`cat ${toolCall.path}`, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Error reading file ${toolCall.path}: ${error} \n ${stderr}`);
        resolve({ type: "error", error: error.message });
      } else {
        resolve({ content: stdout, type: "catRequestResult" });
      }
    });
  });
}

export async function handleGrepRequest(
  toolCall: GrepRequest
): Promise<GrepRequestResult | LLMToolCallError> {
  return new Promise((resolve, _) => {
    exec(
      `grep ${toolCall.flags ? `-${toolCall.flags}` : ""} ${toolCall.pattern} ${toolCall.file}`,
      (error, stdout, stderr) => {
        // grep returns exit code 1 if no matches are found, but that's not an error for our use case.
        // error.code === 1 means "no ma  tches"
        if (error && typeof error.code === "number" && error.code !== 1) {
          logger.error(`Error grepping file ${toolCall.file}: ${error} \n ${stderr}`);
          resolve({ type: "error", error: error.message });
        } else {
          // If error.code === 1, stdout will be empty (no matches), which is fine.
          resolve({ content: "No matches found", type: "grepRequestResult" });
        }
      }
    );
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
    return { type: "logSearchResult", ...logContext };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error searching logs: ${err}`);
    return {
      type: "error",
      error: err.message,
    };
  }
}
