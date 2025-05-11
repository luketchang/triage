import { exec } from "child_process";

import { logger } from "@triage/common";
import { LogsWithPagination, ObservabilityPlatform } from "@triage/observability";

import { LogSearchAgentResponse } from "../nodes/log-search";
import {
  CatRequest,
  CatRequestResult,
  GrepRequest,
  GrepRequestResult,
  LogRequest,
  LogSearchInput,
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
  | LogsWithPagination
  | CatRequestResult
  | GrepRequestResult;

export type LLMToolCallError = { error: string };

export type LLMToolCallResultOrError = LLMToolCallResult | LLMToolCallError;

export class Toolbox {
  private observabilityApi: ObservabilityPlatform;

  constructor(observabilityApi: ObservabilityPlatform) {
    this.observabilityApi = observabilityApi;
  }

  private handleLogSearchRequest(toolCall: LogSearchInput): Promise<LogsWithPagination> {
    return this.observabilityApi.fetchLogs({
      query: toolCall.query,
      start: toolCall.start,
      end: toolCall.end,
      limit: toolCall.limit,
      pageCursor: toolCall.pageCursor || undefined,
    });
  }

  private handleCatRequest(toolCall: CatRequest): Promise<CatRequestResult | LLMToolCallError> {
    return new Promise((resolve) => {
      exec(`cat ${toolCall.path}`, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Error reading file ${toolCall.path}: ${error} \n ${stderr}`);
          resolve({
            error: `${error}`,
          });
        } else {
          resolve({ content: stdout });
        }
      });
    });
  }

  private handleGrepRequest(toolCall: GrepRequest): Promise<GrepRequestResult> {
    return new Promise((resolve, reject) => {
      exec(
        `grep ${toolCall.flags ? `-${toolCall.flags}` : ""} ${toolCall.pattern} ${toolCall.file}`,
        (error, stdout, stderr) => {
          if (error) {
            logger.error(`Error grepping file ${toolCall.file}: ${error} \n ${stderr}`);
            reject(error);
          } else {
            resolve({ content: stdout });
          }
        }
      );
    });
  }

  async invokeToolCall(toolCall: LLMToolCall): Promise<LLMToolCallResultOrError> {
    switch (toolCall.type) {
      case "logSearchInput":
        return this.handleLogSearchRequest(toolCall);
      case "catRequest":
        return this.handleCatRequest(toolCall);
      case "grepRequest":
        return this.handleGrepRequest(toolCall);
      default:
        throw new Error(`Unsupported tool call`);
    }
  }
}
