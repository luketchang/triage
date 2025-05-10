import { exec } from "child_process";

import { logger } from "@triage/common";
import { LogsWithPagination, ObservabilityPlatform } from "@triage/observability";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { LogSearchAgent, LogSearchAgentResponse } from "../nodes/log-search";
import { LogRequest, LogSearchInput } from "../types";

type ToolCallID = {
  toolCallId: string;
};

const catRequestParametersSchema = z.object({
  path: z.string().describe("File path to read"),
});

export const catRequestSchema = {
  description: "Read a file and return the contents. Works exactly like cat in the terminal.",
  parameters: catRequestParametersSchema,
};

type CatRequest = z.infer<typeof catRequestParametersSchema> & { type: "catRequest" };

export type CatRequestResult = {
  content: string;
};

const grepRequestParametersSchema = z.object({
  pattern: z.string().describe("Regular expression pattern to search for"),
  file: z.string().describe("File or directory to search in"),
  flags: z.string().describe("Flags to pass to grep"),
});

export const grepRequestSchema = {
  description:
    "Search for a pattern in a file or directory. Works exactly like grep in the terminal.",
  parameters: grepRequestParametersSchema,
};

type GrepRequest = z.infer<typeof grepRequestParametersSchema> & { type: "grepRequest" };

type GrepRequestResult = {
  content: string;
};

export type LLMToolCall = ToolCallID & (LogRequest | LogSearchInput | CatRequest | GrepRequest);

export type LLMToolCallResult =
  | LogSearchAgentResponse
  | LogsWithPagination
  | CatRequestResult
  | GrepRequestResult;

export type LLMToolCallError = { error: string };

export type LLMToolCallResultOrError = LLMToolCallResult | LLMToolCallError;

export class Toolbox {
  private observabilityApi: ObservabilityPlatform;
  private logSearchAgent: LogSearchAgent;

  constructor(observabilityApi: ObservabilityPlatform, logSearchAgent: LogSearchAgent) {
    this.observabilityApi = observabilityApi;
    this.logSearchAgent = logSearchAgent;
  }

  private handleLogRequest(toolCall: LogRequest): Promise<LogSearchAgentResponse> {
    // TODO: Add logLabelsMap to tool call. Not used yet.
    return this.logSearchAgent.invoke({
      logSearchId: uuidv4(),
      logRequest: toolCall.request,
    });
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
      case "logRequest":
        return this.handleLogRequest(toolCall);
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
