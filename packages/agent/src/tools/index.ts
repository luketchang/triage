import { exec } from "child_process";

import { logger } from "@triage/common";
import { LogsClient } from "@triage/data-integrations";

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
  LogSearchRequest,
  LogSearchResult,
} from "../types";

type ToolCallID = {
  toolCallId: string;
};

export type LLMToolCall = ToolCallID & (LogSearchRequest | CatRequest | GrepRequest);

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
  toolCall: GrepRequest,
  repoPath: string
): Promise<GrepRequestResult | LLMToolCallError> {
  return new Promise((resolve, _) => {
    exec(
      `cd ${repoPath} && git grep ${toolCall.flags ? `-${toolCall.flags}` : ""} -e "${toolCall.pattern}"`,
      (error, stdout, stderr) => {
        if (error) {
          // grep exit code 1 means no matches found
          if (error.code === 1) {
            resolve({
              type: "result",
              content: "",
              toolCallType: "grepRequest",
            });
          } else {
            logger.error(`Error grepping pattern ${toolCall.pattern}: ${error} \n ${stderr}`);
            resolve({
              type: "error",
              toolCallType: "grepRequest",
              error: error.message,
            });
          }
        } else {
          // Matches found
          logger.info(`Result for grep request ${toolCall.pattern}: ${stdout}`);
          resolve({
            type: "result",
            content: stdout,
            toolCallType: "grepRequest",
          });
        }
      }
    );
  });
}

export async function handleLogSearchRequest(
  toolCall: LogSearchRequest,
  logsClient: LogsClient
): Promise<LogSearchResult | LLMToolCallError> {
  try {
    const logContext = await logsClient.fetchLogs(toolCall);
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
