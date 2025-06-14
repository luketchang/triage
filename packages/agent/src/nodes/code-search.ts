import { isAbortError, logger, timer } from "@triage/common";
import { LanguageModelV1, streamText } from "ai";
import { v4 as uuidv4 } from "uuid";

import { TriagePipelineConfig } from "../pipeline";
import {
  CodeSearchStep,
  CodeSearchToolCallWithResult,
  LogSearchToolCallWithResult,
  StepsType,
} from "../pipeline/state";
import { PipelineStateManager } from "../pipeline/state-manager";
import { handleCatRequest, handleGrepRequest, LLMToolCall } from "../tools";
import {
  catRequestToolSchema,
  CodeSearchInput,
  grepRequestToolSchema,
  TaskComplete,
  UserMessage,
} from "../types";
import {
  formatCodeSearchToolCallsWithResults,
  formatLogSearchToolCallsWithResults,
  formatUserMessage,
} from "../utils";

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
  userMessage: UserMessage;
  codeRequest: string;
  fileTree: string;
  logSearchToolCallsWithResults: LogSearchToolCallWithResult[];
  previousCodeSearchToolCallsWithResults: CodeSearchToolCallWithResult[];
  remainingQueries: number;
  codebaseOverview: string;
  repoPath: string;
}): string {
  const currentTime = new Date().toISOString();

  const formattedPreviousCodeSearchSteps = formatCodeSearchToolCallsWithResults(
    params.previousCodeSearchToolCallsWithResults
  );
  const formattedPreviousLogSearchSteps = formatLogSearchToolCallsWithResults(
    params.logSearchToolCallsWithResults
  );

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
${formatUserMessage(params.userMessage)}
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
  constructor(
    private readonly llmClient: LanguageModelV1,
    private readonly state: PipelineStateManager,
    private readonly config: TriagePipelineConfig
  ) {}

  async invoke(params: {
    codeSearchId: string;
    userMessage: UserMessage;
    codeRequest: string;
    fileTree: string;
    logSearchToolCallsWithResults: LogSearchToolCallWithResult[];
    previousCodeSearchToolCallsWithResults: CodeSearchToolCallWithResult[];
    remainingQueries: number;
    codebaseOverview: string;
    repoPath: string;
  }): Promise<CodeSearchResponse> {
    const prompt = createCodeSearchPrompt({
      ...params,
    });

    try {
      const { toolCalls, textStream } = streamText({
        model: this.llmClient,
        system: SYSTEM_PROMPT,
        prompt: prompt,
        tools: {
          catRequest: catRequestToolSchema,
          grepRequest: grepRequestToolSchema,
        },
        toolChoice: "auto",
        abortSignal: this.config.abortSignal,
      });

      let text = "";
      for await (const chunk of textStream) {
        this.state.addStreamingUpdate("codeSearch", params.codeSearchId, chunk);
        text += chunk;
      }

      logger.info(`Code search reasoning:\n${text}`);

      // End loop if no tool calls returned, similar to Reasoner
      const finalizedToolCalls = await toolCalls;
      if (!finalizedToolCalls || finalizedToolCalls.length === 0) {
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
      for (const toolCall of finalizedToolCalls) {
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
      // If the operation was aborted, propagate the error
      if (isAbortError(error)) {
        logger.info(`Code search aborted: ${error}`);
        throw error; // Don't retry on abort
      }

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
    this.codeSearch = new CodeSearch(this.config.fastClient, this.state, this.config);
  }

  @timer
  async invoke(params: {
    codeRequest: string;
    maxIters?: number;
  }): Promise<CodeSearchAgentResponse> {
    logger.info("\n\n" + "=".repeat(25) + " Code Search " + "=".repeat(25));

    let response: CodeSearchResponse | null = null;
    const maxIters = params.maxIters || MAX_ITERS;
    let currentIter = 0;
    let newCodeSearchSteps: CodeSearchStep[] = [];

    while ((!response || Array.isArray(response.actions)) && currentIter < maxIters) {
      // Get the latest code search steps from state
      const catToolCallsWithResults = this.state.getCatToolCallsWithResults(StepsType.BOTH);
      const grepToolCallsWithResults = this.state.getGrepToolCallsWithResults(StepsType.BOTH);
      const previousCodeSearchToolCallsWithResults: CodeSearchToolCallWithResult[] = [
        ...catToolCallsWithResults,
        ...grepToolCallsWithResults,
      ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const codeSearchId = uuidv4();
      response = await this.codeSearch.invoke({
        codeSearchId,
        userMessage: this.config.userMessage,
        codeRequest: params.codeRequest,
        fileTree: this.config.fileTree,
        logSearchToolCallsWithResults: this.state.getLogSearchToolCallsWithResults(StepsType.BOTH),
        previousCodeSearchToolCallsWithResults,
        remainingQueries: maxIters - currentIter,
        codebaseOverview: this.config.codebaseOverview,
        repoPath: this.config.repoPath,
      });

      currentIter++;

      if (Array.isArray(response.actions)) {
        logger.info(
          `Searching filepaths:\n${response.actions.map((toolCall) => JSON.stringify(toolCall)).join("\n")}`
        );

        let toolCallsWithResults: CodeSearchToolCallWithResult[] = [];
        for (const toolCall of response.actions) {
          if (toolCall.type === "catRequest") {
            const result = await handleCatRequest(toolCall);
            toolCallsWithResults.push({
              type: "cat",
              timestamp: new Date(),
              input: toolCall,
              output: result,
            });
          } else if (toolCall.type === "grepRequest") {
            const result = await handleGrepRequest(toolCall, this.config.repoPath);
            toolCallsWithResults.push({
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
          id: codeSearchId,
          timestamp: new Date(),
          reasoning: response.reasoning,
          data: toolCallsWithResults,
        };
        newCodeSearchSteps.push(codeSearchStep);
        this.state.addUpdate(codeSearchStep);
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
