import { logger, timer } from "@triage/common";
import { generateText, LanguageModelV1 } from "ai";
import { v4 as uuidv4 } from "uuid";

import { TriagePipelineConfig } from "../pipeline";
import {
  CodeSearchStep,
  CodeSearchToolCall,
  LogSearchToolCall,
  StepsType,
} from "../pipeline/state";
import { PipelineStateManager } from "../pipeline/state-manager";
import { handleCatRequest, handleGrepRequest, LLMToolCall } from "../tools";
import {
  catRequestToolSchema,
  CodeSearchInput,
  grepRequestToolSchema,
  TaskComplete,
} from "../types";
import { formatCodeSearchToolCalls, formatLogSearchToolCalls } from "../utils";

export interface CodeSearchAgentResponse {
  newCodeSearchSteps: CodeSearchStep[];
}

export interface CodeSearchToolCalls {
  type: "codeSearchToolCalls";
  toolCalls: LLMToolCall[];
}

export interface CodeSearchResponse {
  reasoning: string;
  actions: CodeSearchInput[] | TaskComplete;
}

const MAX_ITERS = 12;

const SYSTEM_PROMPT = `
You are an expert AI assistant that helps engineers debug production issues by searching through code. Your task is to find code relevant to the issue/event.
`;

function createCodeSearchPrompt(params: {
  query: string;
  codeRequest: string;
  fileTree: string;
  logSearches: LogSearchToolCall[];
  previousCodeSearches: CodeSearchToolCall[];
  remainingQueries: number;
  codebaseOverview: string;
  repoPath: string;
}): string {
  const currentTime = new Date().toISOString();

  const formattedPreviousCodeSearchSteps = formatCodeSearchToolCalls(params.previousCodeSearches);
  const formattedPreviousLogSearchSteps = formatLogSearchToolCalls(params.logSearches);

  // TODO: split out last code search steps into its own section
  return `
Given a user query about the issue/event and gathered context from the logs, your task is to fetch additional code that will help you achieve the following: ${params.codeRequest}. You will do so by outputting one or more \`grepRequest\` or \`catRequest\` tool calls to read code from codebase. If you feel you have enough code for the objective and have thoroughly explored the relevant tangential files, do not output a tool call (no tool calls indicate you are done). The objective you're helping with will usually be a subtask of answering the user query.

## Tips
- You do not have to follow the given task exactly but you must iterate and find increasingly more relevant context that will eventually help the agent figure out the answer to the user query/issue/event.
- If you're not sure where to start, use \`grepRequest\` to search for common keywords in the codebase. 
- Bias towards making many \`grepRequest\` or \`catRequest\` tool calls at once to fetch code. If you are still early on in exploration, you should be making 5-8 \`grepRequest\` or \`catRequest\` calls per iteration. This makes for much more efficient and effective exploration.
- Your goal is recall over precision so prioritize breadth of search and visiting any even slightly relevant/tangential files to the issue/event. You would rather over-explore and return many files that aren't directly relevant over under-exploring and missing key files.
- Especially in microservices, the root cause may not be in the service that is failing, but in another service that is interacting with it. Explore code in other services other than the one displaying the symptom and explore very widely.
- Look at the previous code context to see what code you have already fetched and what queries you've tried. Use this knowledge to reason about other potential sources of the issue/event and to inform your next queries as you to keep finding information until the issue/event is resolved.

## Rules:
- All file paths passed to \`catRequest\` must be absolute. Refer directly to paths in the provided file tree or git-grep output and prepend with ${params.repoPath}.
- DO NOT read the same files more than once. Look at your previous code context to double check which files you have already read so you do not reread them.
- Output your reasoning for each tool call outside the tool calls and explain where you are exploring and where you will likely explore next. Use 3-5 sentences max.


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
    logSearches: LogSearchToolCall[];
    previousCodeSearches: CodeSearchToolCall[];
    remainingQueries: number;
    codebaseOverview: string;
    repoPath: string;
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

      logger.info(`Code search reasoning:\n${text}`);

      // End loop if no tool calls returned, similar to Reasoner
      if (!toolCalls || toolCalls.length === 0) {
        logger.info("No more tool calls returned");
        return {
          reasoning: text,
          actions: {
            type: "taskComplete",
            reasoning: text,
            summary: "Code search task complete",
          },
        };
      }

      let outputToolCalls: CodeSearchInput[] = [];
      for (const toolCall of toolCalls) {
        if (toolCall.toolName === "catRequest") {
          outputToolCalls.push({
            type: "catRequest",
            path: toolCall.args.path,
          });
        } else if (toolCall.toolName === "grepRequest") {
          outputToolCalls.push({
            type: "grepRequest",
            pattern: toolCall.args.pattern,
            flags: toolCall.args.flags,
          });
        }
      }

      return {
        reasoning: text,
        actions: outputToolCalls,
      };
    } catch (error) {
      // TODO: revisit this
      logger.error("Error generating code search output:", error);
      return {
        reasoning: "Error generating code search output",
        actions: [],
      };
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
    codeRequest: string;
    maxIters?: number;
  }): Promise<CodeSearchAgentResponse> {
    logger.info("\n\n" + "=".repeat(25) + " Code Search " + "=".repeat(25));
    const codeSearchId = uuidv4();
    this.state.recordHighLevelStep("codeSearch", codeSearchId);

    let response: CodeSearchResponse | null = null;
    const maxIters = params.maxIters || MAX_ITERS;
    let currentIter = 0;
    let newCodeSearchSteps: CodeSearchStep[] = [];

    while ((!response || Array.isArray(response.actions)) && currentIter < maxIters) {
      // Get the latest code search steps from state
      const cats = this.state.getCatToolCalls(StepsType.BOTH);
      const greps = this.state.getGrepToolCalls(StepsType.BOTH);
      const previousCodeSearches: CodeSearchToolCall[] = [...cats, ...greps].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      response = await this.codeSearch.invoke({
        query: this.config.query,
        codeRequest: params.codeRequest,
        fileTree: this.config.fileTree,
        logSearches: this.state.getLogSearchToolCalls(StepsType.BOTH),
        previousCodeSearches,
        remainingQueries: maxIters - currentIter,
        codebaseOverview: this.config.codebaseOverview,
        repoPath: this.config.repoPath,
      });

      currentIter++;

      if (Array.isArray(response.actions)) {
        logger.info(
          `Searching filepaths:\n${response.actions.map((toolCall) => JSON.stringify(toolCall)).join("\n")}`
        );

        let toolCalls: CodeSearchToolCall[] = [];
        for (const toolCall of response.actions) {
          if (toolCall.type === "catRequest") {
            const result = await handleCatRequest(toolCall);
            toolCalls.push({
              type: "cat",
              timestamp: new Date(),
              input: toolCall,
              output: result,
            });
          } else if (toolCall.type === "grepRequest") {
            const result = await handleGrepRequest(toolCall, this.config.repoPath);
            toolCalls.push({
              type: "grep",
              timestamp: new Date(),
              input: toolCall,
              output: result,
            });
          } else {
            throw new Error(`Unknown tool call type: ${toolCall}`);
          }
        }

        const codeSearchStep: CodeSearchStep = {
          type: "codeSearch",
          timestamp: new Date(),
          reasoning: response.reasoning,
          data: toolCalls,
        };
        newCodeSearchSteps.push(codeSearchStep);
        this.state.addIntermediateStep(codeSearchStep, codeSearchId);
      } else {
        logger.info("Code search complete");
      }
    }

    if (currentIter >= maxIters && (!response || Array.isArray(response.actions))) {
      logger.info(
        `Code search reached maximum iterations (${maxIters}). Completing search forcibly.`
      );
    }

    return {
      newCodeSearchSteps,
    };
  }
}
