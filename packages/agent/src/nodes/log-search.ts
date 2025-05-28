import { isAbortError, logger, timer } from "@triage/common";
import { ObservabilityClient } from "@triage/data-integrations";
import { LanguageModelV1, streamText } from "ai";
import { DateTime } from "luxon";
import { v4 as uuidv4 } from "uuid";

import { TriagePipelineConfig } from "../pipeline";
import { LogSearchStep, LogSearchToolCallWithResult, StepsType } from "../pipeline/state";
import { PipelineStateManager } from "../pipeline/state-manager";
import { handleLogSearchRequest } from "../tools";
import { logSearchInputToolSchema, LogSearchRequest, TaskComplete, UserMessage } from "../types";
import {
  ensureSingleToolCall,
  formatFacetValues,
  formatLogSearchToolCallsWithResults,
  formatUserMessage,
} from "../utils";

export interface LogSearchAgentResponse {
  newLogSearchSteps: LogSearchStep[];
}

export interface LogSearchResponse {
  reasoning: string;
  actions: LogSearchRequest[] | TaskComplete;
}

const MAX_ITERS = 12;

const SYSTEM_PROMPT = `
You are an expert AI assistant that helps engineers debug production issues by searching through logs. Your task is to find logs relevant to the issue/event.
`;

function createLogSearchPrompt(params: {
  userMessage: UserMessage;
  timezone: string;
  logRequest: string;
  platformSpecificInstructions: string;
  previousLogSearchToolCallsWithResults: LogSearchToolCallWithResult[];
  lastLogSearchToolCallWithResult?: LogSearchToolCallWithResult;
  logLabelsMap: Map<string, string[]>;
  remainingQueries: number;
  codebaseOverview: string;
}): string {
  const currentTime = DateTime.now().setZone(params.timezone).toISO();

  // Format the previous log query result for display
  const formattedLastLogSearchStep = params.lastLogSearchToolCallWithResult
    ? formatLogSearchToolCallsWithResults([params.lastLogSearchToolCallWithResult])
    : "";

  // TODO: consider removing the line about removing all filters
  return `
Given all available log labels, a user query about the issue/event, and previously gathered log context your task is to fetch logs for the following objective: ${params.logRequest}. You will do so by outputting a \`LogSearchInput\` output to read logs from observability API. If you feel you have enough logs for the objective, do not output a tool call (no tool calls indicate you are done). The objective you're helping with will usually be a subtask of answering the user query.

## Tips
- DO NOT query logs from non-user-facing services. This includes services such as mongo, controller, agent, alloy, operator, nats, cluster-agent, desktop-vpnkit-controller, metrics-server, etcd, redis, etc (think anything collector or infrastructure related).
- Early on in exploration, tag multiple services in your queries instead of doing multiple searches each with one service tagged.
- As you make queries, pay attention to the results in <previous_log_query_result> to see the results of your last query and <log_results_history> to see the results of all previous queries. You should make decisions on future queries based on the results of your previous queries.
- Look for important identifiers such as users or IDs and use those in future queries to narrow the context temporarily.
- As you find log results indicative of the exact issue/event, you should try to find additional logs that precede and reveal information about the issue/event.
- For at least one of your queries you will make as you explore, zoom out and remove most filters to get a broader view of the system.
- Your overall goal is to find queries that returns logs across the related services with as much important surrounding context and events as possible.
- Do not filter on random keywords. You should only filter on: service name, part of an error message, or a unique identifier.
- Do not filter on code snippets (e.g. file names, classes, methods, component tags, etc).
- If you are getting empty log results, try the following:
  - Shorten keyword filters
  - Remove keyword filters
  - Use attribute filters in place of plain keyword filters
  - Widen time range
  - Add more services to the query
- Anchor your queries around the timestamps provided in the user query or the attached context, if any.

## Rules:
- Output  one  \`LogSearchInput\` at a time. DO NOT output multiple \`LogSearchInput\` tool calls.
- Look at the context previously gathered to see what logs you have already fetched and what queries you've tried, DO NOT repeat past queries.
- DO NOT query the same services multiple times with slightly different configurations - this wastes iterations and provides redundant information.
- If you're not finding any logs with specific error keywords, switch to service-only queries to get a system overview first.
- Output your reasoning for each tool call outside the tool calls and explain where you are exploring and where you will likely explore next. Use 3-5 sentences max.


<remaining_queries>
${params.remainingQueries}
</remaining_queries>

<current_time_in_user_local_timezone>
${currentTime}
</current_time_in_user_local_timezone>

<query>
${formatUserMessage(params.userMessage)}
</query>

<log_labels>
${formatFacetValues(params.logLabelsMap)}
</log_labels>

<platform_specific_instructions>
${params.platformSpecificInstructions}
</platform_specific_instructions>

<previous_log_query_result>
${formattedLastLogSearchStep}
</previous_log_query_result>

<log_results_history>
${formatLogSearchToolCallsWithResults(params.previousLogSearchToolCallsWithResults)}
</log_results_history>

<system_overview>
${params.codebaseOverview}
</system_overview>
`;
}

class LogSearch {
  private llmClient: LanguageModelV1;
  private observabilityClient: ObservabilityClient;
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;

  constructor(
    llmClient: LanguageModelV1,
    observabilityClient: ObservabilityClient,
    config: TriagePipelineConfig,
    state: PipelineStateManager
  ) {
    this.llmClient = llmClient;
    this.observabilityClient = observabilityClient;
    this.config = config;
    this.state = state;
  }

  async invoke(params: {
    logSearchId: string;
    userMessage: UserMessage;
    timezone: string;
    logRequest: string;
    previousLogSearchToolCallsWithResults: LogSearchToolCallWithResult[];
    lastLogSearchToolCallWithResult?: LogSearchToolCallWithResult;
    logLabelsMap: Map<string, string[]>;
    remainingQueries: number;
    codebaseOverview: string;
  }): Promise<LogSearchResponse> {
    const prompt = createLogSearchPrompt({
      ...params,
      platformSpecificInstructions: this.observabilityClient.getLogSearchQueryInstructions(),
    });

    try {
      const { toolCalls, textStream } = streamText({
        model: this.llmClient,
        system: SYSTEM_PROMPT,
        prompt: prompt,
        tools: {
          logSearchInput: logSearchInputToolSchema,
        },
        toolChoice: "auto",
        abortSignal: this.config.abortSignal,
      });

      let text = "";
      for await (const chunk of textStream) {
        this.state.addStreamingUpdate("logSearch", params.logSearchId, chunk);
        text += chunk;
      }

      logger.info(`Log search reasoning:\n${text}`);

      const finalizedToolCalls = await toolCalls;

      // End loop if no tool calls returned, similar to Reasoner
      if (!finalizedToolCalls || finalizedToolCalls.length === 0) {
        return {
          reasoning: text,
          actions: {
            type: "taskComplete",
            reasoning: text,
            summary: "Log search task complete",
          },
        };
      }

      const toolCall = ensureSingleToolCall(finalizedToolCalls);

      if (toolCall.toolName === "logSearchInput") {
        return {
          reasoning: text,
          actions: [
            {
              type: "logSearchInput",
              ...toolCall.args,
            },
          ],
        };
      } else {
        throw new Error(`Unexpected tool name: ${toolCall.toolName}`);
      }
    } catch (error) {
      // If the operation was aborted, propagate the error
      if (isAbortError(error)) {
        logger.info(`Log search aborted: ${error}`);
        throw error; // Don't retry on abort
      }

      logger.error("Error generating log search query:", error);
      // TODO: revisit fallback
      return {
        reasoning: "Error generating log search query",
        actions: [
          {
            type: "logSearchInput",
            start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
            query: "service:orders OR service:payments OR service:tickets OR service:expiration",
            limit: 500,
            pageCursor: undefined,
          },
        ],
      };
    }
  }
}

export class LogSearchAgent {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;
  private logSearch: LogSearch;

  constructor(config: TriagePipelineConfig, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
    this.logSearch = new LogSearch(
      this.config.fastClient,
      this.config.observabilityClient,
      this.config,
      state
    );
  }

  @timer
  async invoke(params: { logRequest: string; maxIters?: number }): Promise<LogSearchAgentResponse> {
    logger.info("\n\n" + "=".repeat(25) + " Log Search " + "=".repeat(25));

    let response: LogSearchResponse | null = null;
    const maxIters = params.maxIters || MAX_ITERS;
    let currentIter = 0;
    let newLogSearchSteps: LogSearchStep[] = [];

    while ((!response || Array.isArray(response.actions)) && currentIter < maxIters) {
      const previousLogSearchToolCallsWithResults = this.state.getLogSearchToolCallsWithResults(
        StepsType.BOTH
      );
      let lastLogSearchToolCallWithResult: LogSearchToolCallWithResult | undefined = undefined;
      if (previousLogSearchToolCallsWithResults.length > 0) {
        lastLogSearchToolCallWithResult =
          previousLogSearchToolCallsWithResults[previousLogSearchToolCallsWithResults.length - 1];
      }

      // TODO: should enable multiple log searches at once
      const logSearchId = uuidv4();
      response = await this.logSearch.invoke({
        logSearchId,
        userMessage: this.config.userMessage,
        timezone: this.config.timezone,
        logRequest: params.logRequest,
        logLabelsMap: this.config.logLabelsMap,
        previousLogSearchToolCallsWithResults,
        lastLogSearchToolCallWithResult,
        remainingQueries: maxIters - currentIter,
        codebaseOverview: this.config.codebaseOverview,
      });

      currentIter++;

      if (Array.isArray(response.actions)) {
        logger.info(
          `Searching logs with query: ${response.actions[0]!.query} from ${response.actions[0]!.start} to ${response.actions[0]!.end}`
        );

        // TODO: convert this into loop when we have multiple tool calls output
        let toolCallsWithResults: LogSearchToolCallWithResult[] = [];

        logger.info("Fetching logs from observability client...");
        const logContext = await handleLogSearchRequest(
          // TODO: remove once we allow multiple log search tool calls
          response.actions[0],
          this.config.observabilityClient
        );

        const lastLogSearchResultsFormatted =
          formatLogSearchToolCallsWithResults(toolCallsWithResults);
        logger.info(`Log search results:\n${lastLogSearchResultsFormatted}`);

        toolCallsWithResults.push({
          type: "logSearch",
          timestamp: new Date(),
          input: response.actions[0]!,
          output: logContext,
        });

        const logSearchStep: LogSearchStep = {
          id: logSearchId,
          type: "logSearch",
          timestamp: new Date(),
          reasoning: response.reasoning,
          data: toolCallsWithResults,
        };
        newLogSearchSteps.push(logSearchStep);
        this.state.addUpdate(logSearchStep);
      } else {
        logger.info("Log search complete");
      }
    }

    if (currentIter >= maxIters && (!response || Array.isArray(response.actions))) {
      logger.info(
        `Log search reached maximum iterations (${maxIters}). Completing search forcibly.`
      );
    }

    return {
      newLogSearchSteps,
    };
  }
}
