import { exec } from "child_process";

import { logger } from "@triage/common";
import { LogsWithPagination, ObservabilityPlatform } from "@triage/observability";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { LogSearchAgent, LogSearchAgentResponse } from "../nodes/log-search";
import { LogRequest, LogSearchInput } from "../types";

export type ToolCallID = {
  toolCallId: string;
};

const catRequestParametersSchema = z.object({
  path: z.string().describe("File path to read"),
});

export const catRequestSchema = {
  description: "Read a file and return the contents. Works exactly like cat in the terminal.",
  parameters: catRequestParametersSchema,
};

export type CatRequest = z.infer<typeof catRequestParametersSchema> & { type: "catRequest" };

export const multiCatRequestParametersSchema = z.object({
  paths: z
    .array(catRequestParametersSchema)
    .describe(
      "Array of file paths to read. Each file path will be read via the cat terminal command."
    ),
});

export type CatRequestResult = {
  content: string;
};

const grepRequestParametersSchema = z.object({
  pattern: z.string().describe("Regular expression pattern to search for"),
  file: z.string().describe("File or directory to search in"),
  flags: z
    .string()
    .describe(
      "One or more single-letter grep flags combined without spaces (e.g., 'rni' for -r -n -i). Do not include dashes (e.g., write 'rni', not '-rni' or '--rni')."
    ),
});

export const grepRequestSchema = {
  description:
    "Search for a pattern in a file or directory. Works exactly like grep in the terminal.",
  parameters: grepRequestParametersSchema,
};

export type GrepRequest = z.infer<typeof grepRequestParametersSchema> & { type: "grepRequest" };

export type GrepRequestResult = {
  content: string;
};

export type LLMToolCall = ToolCallID & (LogRequest | LogSearchInput | CatRequest | GrepRequest);

type LLMToolCallResult =
  | LogSearchAgentResponse
  | LogsWithPagination
  | CatRequestResult
  | GrepRequestResult;

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
      query: toolCall.request,
      logRequest: toolCall.request,
      logLabelsMap: new Map(),
      logSearchSteps: [],
      codebaseOverview: "",
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

  private handleCatRequest(toolCall: CatRequest): Promise<CatRequestResult> {
    return new Promise((resolve, reject) => {
      exec(`cat ${toolCall.path}`, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Error reading file ${toolCall.path}: ${error} \n ${stderr}`);
          reject(error);
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

  async invokeToolCall(toolCall: LLMToolCall): Promise<LLMToolCallResult | string> {
    try {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error invoking tool call ${toolCall.type}: ${errorMessage}`);
      return `Error invoking tool call: ${errorMessage}`;
    }
  }
}
