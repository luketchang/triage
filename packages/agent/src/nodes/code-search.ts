import { logger, timer } from "@triage/common";
import { generateText, LanguageModelV1 } from "ai";
import { v4 as uuidv4 } from "uuid";

import { TriagePipelineConfig } from "../pipeline";
import { CatRequest, CatRequestResult, catRequestSchema, Toolbox, ToolCallID } from "../tools";
import { CodeSearchStep, TaskComplete } from "../types";

import { formatCodeSearchSteps } from "./utils";

export interface CodeSearchAgentResponse {
  newCodeSearchSteps: CodeSearchStep[];
}

export type CatToolCall = ToolCallID & CatRequest;
export type MultiCatToolCall = {
  type: "multiCatRequest";
  catToolCalls: CatToolCall[];
};

export type CodeSearchResponse = MultiCatToolCall | TaskComplete;

const MAX_ITERS = 12;

const SYSTEM_PROMPT = `
You are an expert AI assistant that helps engineers debug production issues by searching through code. Your task is to find code relevant to the issue/event.
`;

function createCodeSearchPrompt(params: {
  query: string;
  codeRequest: string;
  fileTree: string;
  previousCodeSearchSteps: CodeSearchStep[];
  remainingQueries: number;
  codebaseOverview: string;
}): string {
  const currentTime = new Date().toISOString();

  const formattedPreviousCodeSearchSteps = formatCodeSearchSteps(params.previousCodeSearchSteps);

  return `
Given a user query about the issue/event, previously gathered code context, your task is to fetch additional code that will help you achieve the following: ${params.codeRequest}. You will do so by outputting a one or more \`grepRequest\` or \`catRequest\` tool calls to read code from codebase. If you feel you have enough code for the objective and have thoroughly explored the relevant tangential files, do not output a tool call (no tool calls indicate you are done). The objective you're helping with will usually be a subtask of answering the user query.

## Tips
- You do not have to follow the given task exactly but you must iterate and find increasingly more relevant context that will eventually help the agent figure out the answer to the user query/issue/event.
- Bias towards making many \`grepRequest\` and \`catRequest\` tool calls at once to fetch code. If you are still early on in exploration, you should be making 5-8 grep calls per iteration. This makes for much more efficient and effective exploration.
- Look at the previous code context to see what code you have already fetched and what queries you've tried. Use this knowledge to reason about other potential sources of the issue/event and to inform your next queries as you to keep finding information until the issue/event is resolved.
- Your goal is recall over precision so prioritize breadth of search and visiting any even slightly relevant/tangential files to the issue/event. You would rather over-explore and return many files that aren't directly relevant over under-exploring and missing key files.

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

<previous_code_context>
${formattedPreviousCodeSearchSteps}
</previous_code_context>

<system_overview>
${params.codebaseOverview}
</system_overview>
`;
}

export class CodeSearch {
  private llmClient: LanguageModelV1;

  constructor(llmClient: LanguageModelV1) {
    this.llmClient = llmClient;
  }

  async invoke(params: {
    query: string;
    codeRequest: string;
    fileTree: string;
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
          catRequest: catRequestSchema,
        },
        toolChoice: "auto",
      });

      // End loop if no tool calls returned, similar to Reasoner
      if (!toolCalls || toolCalls.length === 0) {
        return {
          type: "taskComplete",
          reasoning: text,
          summary: "Log search task complete",
        };
      }

      let output: MultiCatToolCall = {
        type: "multiCatRequest",
        catToolCalls: [],
      };
      for (const toolCall of toolCalls) {
        if (toolCall.toolName === "catRequest") {
          output.catToolCalls.push({
            type: "catRequest",
            toolCallId: toolCall.toolCallId,
            path: toolCall.args.path,
          });
        }
      }

      return output;
    } catch (error) {
      // TODO: revisit this
      logger.error("Error generating code search output:", error);
      return {
        type: "multiCatRequest",
        catToolCalls: [],
      };
    }
  }
}

export class CodeSearchAgent {
  private codeSearch: CodeSearch;

  constructor(
    private readonly config: TriagePipelineConfig,
    private readonly toolbox: Toolbox
  ) {
    this.codeSearch = new CodeSearch(this.config.fastClient);
    this.toolbox = toolbox;
  }

  @timer
  async invoke(params: {
    codeSearchId: string;
    query: string;
    codeRequest: string;
    fileTree: string;
    previousCodeSearchSteps: CodeSearchStep[];
    maxIters?: number;
    codebaseOverview: string;
  }): Promise<CodeSearchAgentResponse> {
    // Variable to store the previous query result (initially undefined)
    let previousCodeSearchSteps = params.previousCodeSearchSteps;

    let response: CodeSearchResponse | null = null;
    const maxIters = params.maxIters || MAX_ITERS;
    let currentIter = 0;

    let newCodeSearchSteps: CodeSearchStep[] = [];
    while ((!response || response.type !== "taskComplete") && currentIter < maxIters) {
      response = await this.codeSearch.invoke({
        query: params.query,
        codeRequest: params.codeRequest,
        fileTree: params.fileTree,
        previousCodeSearchSteps,
        remainingQueries: maxIters - currentIter,
        codebaseOverview: params.codebaseOverview,
      });

      currentIter++;

      if (response.type === "multiCatRequest") {
        logger.info(
          `Searching filepaths: ${response.catToolCalls.map((toolCall) => toolCall.path).join(", ")}`
        );

        try {
          logger.info("Reading code...");
          for (const toolCall of response.catToolCalls) {
            const result = await this.toolbox.invokeToolCall(toolCall);

            if (typeof result === "string") {
              newCodeSearchSteps.push({
                type: "codeSearch",
                timestamp: new Date(),
                filepath: toolCall.path,
                source: result,
              });
            } else {
              const ctx = result as CatRequestResult;
              const step: CodeSearchStep = {
                type: "codeSearch",
                timestamp: new Date(),
                filepath: toolCall.path,
                source: ctx.content,
              };

              if (this.config.onUpdate) {
                this.config.onUpdate({
                  type: "intermediateUpdate",
                  id: uuidv4(),
                  parentId: params.codeSearchId,
                  step,
                });
              }

              newCodeSearchSteps.push(step);
            }
          }

          const lastCodeSearchResultsFormatted = formatCodeSearchSteps(newCodeSearchSteps);
          logger.info(`Code search results:\n${lastCodeSearchResultsFormatted}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error executing code search: ${errorMessage}`);
          // TODO: what to do here?
        }
      } else {
        logger.info("Code search complete");
      }
    }

    if (currentIter >= maxIters && (!response || response.type !== "taskComplete")) {
      logger.info(
        `Code search reached maximum iterations (${maxIters}). Completing search forcibly.`
      );
    }

    return {
      newCodeSearchSteps,
    };
  }
}
