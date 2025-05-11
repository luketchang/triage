import { logger, timer } from "@triage/common";
import { generateText, LanguageModelV1 } from "ai";

import { TriagePipelineConfig } from "../pipeline";
import { CodeSearchStep, LogSearchStep, PipelineStateManager } from "../pipeline/state";
import { handleCatRequest, handleGrepRequest, LLMToolCall, LLMToolCallError } from "../tools";
import {
  CatRequestResult,
  catRequestToolSchema,
  GrepRequestResult,
  grepRequestToolSchema,
  TaskComplete,
} from "../types";

import { formatCodeSearchSteps, formatLogSearchSteps } from "./utils";

export interface CodeSearchAgentResponse {
  newCodeSearchSteps: CodeSearchStep[];
}

export type CodeSearchResponse = LLMToolCall[] | TaskComplete;

const MAX_ITERS = 12;

const SYSTEM_PROMPT = `
You are an expert AI assistant that helps engineers debug production issues by searching through code. Your task is to find code relevant to the issue/event.
`;

function createCodeSearchPrompt(params: {
  query: string;
  codeRequest: string;
  fileTree: string;
  logSearchSteps: LogSearchStep[];
  previousCodeSearchSteps: CodeSearchStep[];
  remainingQueries: number;
  codebaseOverview: string;
}): string {
  const currentTime = new Date().toISOString();

  const formattedPreviousCodeSearchSteps = formatCodeSearchSteps(params.previousCodeSearchSteps);
  const formattedPreviousLogSearchSteps = formatLogSearchSteps(params.logSearchSteps);

  // TODO: split out last code search steps into its own section
  return `
Given a user query about the issue/event, previously gathered code context, your task is to fetch additional code that will help you achieve the following: ${params.codeRequest}. You will do so by outputting a one or more \`grepRequest\` or \`catRequest\` tool calls to read code from codebase. If you feel you have enough code for the objective and have thoroughly explored the relevant tangential files, do not output a tool call (no tool calls indicate you are done). The objective you're helping with will usually be a subtask of answering the user query.

## Tips
- You do not have to follow the given task exactly but you must iterate and find increasingly more relevant context that will eventually help the agent figure out the answer to the user query/issue/event.
- If you're not sure where to start, use \`grepRequest\` to search for common keywords in the codebase. 
- Bias towards making many \`grepRequest\` or \`catRequest\` tool calls at once to fetch code. If you are still early on in exploration, you should be making 5-8 \`grepRequest\` or \`catRequest\` calls per iteration. This makes for much more efficient and effective exploration.
- Your goal is recall over precision so prioritize breadth of search and visiting any even slightly relevant/tangential files to the issue/event. You would rather over-explore and return many files that aren't directly relevant over under-exploring and missing key files.
- Especially in microservices, the root cause may not be in the service that is failing, but in another service that is interacting with it. Explore code in other services other than the one displaying the symptom and explore very widely.
- Look at the previous code context to see what code you have already fetched and what queries you've tried. Use this knowledge to reason about other potential sources of the issue/event and to inform your next queries as you to keep finding information until the issue/event is resolved.
- Output your reasoning for each tool call outside the tool calls and explain where you are explorign and where you will likely explore next.

## Rules:
- Look at the context previously gathered to see what code you have already fetched and what queries you've tried, DO NOT repeat past queries and fetch the same files more than once.

<remaining_queries>
${params.remainingQueries}
</remaining_queries>

<current_time>
${currentTime}
</current_time>

<query>
${params.query}
</query>

<file_tree>
${params.fileTree}
</file_tree>

<previous_log_context>
${formattedPreviousLogSearchSteps}
</previous_log_context>

<previous_code_context>
${formattedPreviousCodeSearchSteps}
</previous_code_context>

<system_overview>
${params.codebaseOverview}
</system_overview>
`;
}

class CodeSearch {
  private llmClient: LanguageModelV1;

  constructor(llmClient: LanguageModelV1) {
    this.llmClient = llmClient;
  }

  async invoke(params: {
    query: string;
    codeRequest: string;
    fileTree: string;
    logSearchSteps: LogSearchStep[];
    previousCodeSearchSteps: CodeSearchStep[];
    remainingQueries: number;
    codebaseOverview: string;
  }): Promise<CodeSearchResponse> {
    const prompt = createCodeSearchPrompt({
      ...params,
    });

    try {
      const { toolCalls, text } = await generateText({
        model: this.llmClient,
        system: SYSTEM_PROMPT,
        prompt: prompt,
        tools: {
          catRequest: catRequestToolSchema,
          grepRequest: grepRequestToolSchema,
        },
        toolChoice: "auto",
      });

      logger.info(`Code search output:\n${text}`);

      // End loop if no tool calls returned, similar to Reasoner
      if (!toolCalls || toolCalls.length === 0) {
        logger.info("No more tool calls returned");
        return {
          type: "taskComplete",
          reasoning: text,
          summary: "Code search task complete",
        };
      }

      let outputToolCalls: LLMToolCall[] = [];
      for (const toolCall of toolCalls) {
        if (toolCall.toolName === "catRequest") {
          outputToolCalls.push({
            type: "catRequest",
            toolCallId: toolCall.toolCallId,
            path: toolCall.args.path,
          });
        } else if (toolCall.toolName === "grepRequest") {
          outputToolCalls.push({
            type: "grepRequest",
            toolCallId: toolCall.toolCallId,
            pattern: toolCall.args.pattern,
            file: toolCall.args.file,
            flags: toolCall.args.flags,
          });
        }
      }

      return outputToolCalls;
    } catch (error) {
      // TODO: revisit this
      logger.error("Error generating code search output:", error);
      return [];
    }
  }
}

export class CodeSearchAgent {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;
  private codeSearch: CodeSearch;

  constructor(config: TriagePipelineConfig, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
    this.codeSearch = new CodeSearch(this.config.fastClient);
  }

  @timer
  async invoke(params: {
    codeSearchId: string;
    codeRequest: string;
    maxIters?: number;
  }): Promise<CodeSearchAgentResponse> {
    let response: CodeSearchResponse | null = null;
    const maxIters = params.maxIters || MAX_ITERS;
    let currentIter = 0;
    let newCodeSearchSteps: CodeSearchStep[] = [];

    while ((!response || Array.isArray(response)) && currentIter < maxIters) {
      // Get the latest code search steps from state
      const catSteps = this.state.getCatSteps();
      const grepSteps = this.state.getGrepSteps();
      const previousCodeSearchSteps: CodeSearchStep[] = [...catSteps, ...grepSteps].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      response = await this.codeSearch.invoke({
        query: this.config.query,
        codeRequest: params.codeRequest,
        fileTree: this.config.fileTree,
        logSearchSteps: this.state.getLogSearchSteps(),
        previousCodeSearchSteps,
        remainingQueries: maxIters - currentIter,
        codebaseOverview: this.config.codebaseOverview,
      });

      currentIter++;

      if (Array.isArray(response)) {
        logger.info(
          `Searching filepaths:\n${response.map((toolCall) => JSON.stringify(toolCall)).join("\n")}`
        );

        try {
          logger.info("Making tool calls...");
          for (const toolCall of response) {
            let step: CodeSearchStep | null = null;
            try {
              let result: CatRequestResult | GrepRequestResult | LLMToolCallError;
              if (toolCall.type === "catRequest") {
                result = await handleCatRequest(toolCall);
              } else if (toolCall.type === "grepRequest") {
                result = await handleGrepRequest(toolCall);
              } else {
                throw new Error(`Unknown tool call type: ${toolCall.type}`);
              }

              // TODO: fix this double type checking
              if (toolCall.type === "catRequest" && result.type === "error") {
                step = {
                  type: "cat",
                  timestamp: new Date(),
                  path: toolCall.path,
                  source: result.error,
                };
              } else if (toolCall.type === "grepRequest" && result.type === "error") {
                step = {
                  type: "grep",
                  timestamp: new Date(),
                  pattern: toolCall.pattern,
                  file: toolCall.file,
                  flags: toolCall.flags,
                  output: result.error,
                };
              } else if (toolCall.type === "catRequest" && result.type === "catRequestResult") {
                step = {
                  type: "cat",
                  timestamp: new Date(),
                  path: toolCall.path,
                  source: result.content,
                };
              } else if (toolCall.type === "grepRequest" && result.type === "grepRequestResult") {
                step = {
                  type: "grep",
                  timestamp: new Date(),
                  pattern: toolCall.pattern,
                  file: toolCall.file,
                  flags: toolCall.flags,
                  output: result.content,
                };
              } else {
                throw new Error(`Unknown tool call type: ${toolCall.type}`);
              }

              this.state.addIntermediateStep(step, params.codeSearchId);
              newCodeSearchSteps.push(step);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              if (toolCall.type === "catRequest") {
                step = {
                  type: "cat",
                  timestamp: new Date(),
                  path: toolCall.path,
                  source: errorMessage,
                };
              } else if (toolCall.type === "grepRequest") {
                step = {
                  type: "grep",
                  timestamp: new Date(),
                  pattern: toolCall.pattern,
                  file: toolCall.file,
                  flags: toolCall.flags,
                  output: errorMessage,
                };
              } else {
                throw new Error(`Unknown tool call type: ${toolCall.type}`);
              }

              this.state.addIntermediateStep(step, params.codeSearchId);
              newCodeSearchSteps.push(step);
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error executing code search: ${errorMessage}`);
          // TODO: what to do here?
        }
      } else {
        logger.info("Code search complete");
      }
    }

    if (currentIter >= maxIters && (!response || Array.isArray(response))) {
      logger.info(
        `Code search reached maximum iterations (${maxIters}). Completing search forcibly.`
      );
    }

    return {
      newCodeSearchSteps,
    };
  }
}
