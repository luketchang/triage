import { exec } from "child_process";

import { logger } from "@triage/common";
import { ObservabilityPlatform } from "@triage/observability";

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

export class Toolbox {
  private observabilityApi: ObservabilityPlatform;

  constructor(observabilityApi: ObservabilityPlatform) {
    this.observabilityApi = observabilityApi;
  }

  private async handleLogSearchRequest(
    toolCall: LogSearchInput
  ): Promise<LogSearchResult | LLMToolCallError> {
    try {
      const logs = await this.observabilityApi.fetchLogs({
        query: toolCall.query,
        start: toolCall.start,
        end: toolCall.end,
        limit: toolCall.limit,
        pageCursor: toolCall.pageCursor || undefined,
      });

      return {
        type: "logSearchResult",
        ...logs,
      };
    } catch (error) {
      logger.error(`Error fetching logs: ${error}`);
      return {
        error: `${error}`,
      };
    }
  }

  private async handleCatRequest(
    toolCall: CatRequest
  ): Promise<CatRequestResult | LLMToolCallError> {
    return new Promise((resolve) => {
      exec(`cat ${toolCall.path}`, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Error reading file ${toolCall.path}: ${error} \n ${stderr}`);
          resolve({
            error: `${error}`,
          });
        } else {
          resolve({
            type: "catRequestResult",
            content: stdout,
          });
        }
      });
    });
  }

  private async handleGrepRequest(
    toolCall: GrepRequest
  ): Promise<GrepRequestResult | LLMToolCallError> {
    return new Promise((resolve, reject) => {
      exec(
        `grep ${toolCall.flags ? `-${toolCall.flags}` : ""} ${toolCall.pattern} ${toolCall.file}`,
        (error, stdout, stderr) => {
          if (error) {
            logger.error(`Error grepping file ${toolCall.file}: ${error} \n ${stderr}`);
            reject(error);
          } else {
            resolve({
              type: "grepRequestResult",
              content: stdout,
            });
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
