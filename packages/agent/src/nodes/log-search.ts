import { logger, timer } from "@triage/common";
import { ObservabilityPlatform } from "@triage/observability";
import { generateText, LanguageModelV1 } from "ai";

import { TriagePipelineConfig } from "../pipeline";
import { LogSearchStep, PipelineStateManager, StepsType } from "../pipeline/state";
import { handleLogSearchRequest } from "../tools";
import { LogSearchInput, logSearchInputToolSchema, TaskComplete } from "../types";

import { ensureSingleToolCall, formatFacetValues, formatLogSearchSteps } from "./utils";

export interface LogSearchAgentResponse {
  type: "logSearchAgentResponse";
  newLogSearchSteps: LogSearchStep[];
}

export type LogSearchResponse = LogSearchInput | TaskComplete;

const MAX_ITERS = 12;

const SYSTEM_PROMPT = `
You are an expert AI assistant that helps engineers debug production issues by searching through logs. Your task is to find logs relevant to the issue/event.
`;

function createLogSearchPrompt(params: {
  query: string;
  logRequest: string;
  previousLogSearchSteps: LogSearchStep[];
  platformSpecificInstructions: string;
  lastLogSearchStep?: LogSearchStep;
  logLabelsMap: Map<string, string[]>;
  remainingQueries: number;
  codebaseOverview: string;
}): string {
  const currentTime = new Date().toISOString();

  // Format the previous log query result for display
  const formattedLastLogSearchStep = params.lastLogSearchStep
    ? formatLogSearchSteps([params.lastLogSearchStep])
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

## Rules:
- Output  one  \`LogSearchInput\` at a time. DO NOT output multiple \`LogSearchInput\` tool calls.
- Look at the context previously gathered to see what logs you have already fetched and what queries you've tried, DO NOT repeat past queries.
- DO NOT query the same services multiple times with slightly different configurations - this wastes iterations and provides redundant information.
- If you're not finding any logs with specific error keywords, switch to service-only queries to get a system overview first.
- Output your reasoning for each tool call outside the tool calls and explain where you are exploring and where you will likely explore next.

<remaining_queries>
${params.remainingQueries}
</remaining_queries>

<current_time>
${currentTime}
</current_time>

<query>
${params.query}
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
${formatLogSearchSteps(params.previousLogSearchSteps)}
</log_results_history>

<system_overview>
${params.codebaseOverview}
</system_overview>
`;
}

class LogSearch {
  private llmClient: LanguageModelV1;
  private observabilityPlatform: ObservabilityPlatform;

  constructor(llmClient: LanguageModelV1, observabilityPlatform: ObservabilityPlatform) {
    this.llmClient = llmClient;
    this.observabilityPlatform = observabilityPlatform;
  }

  async invoke(params: {
    query: string;
    logRequest: string;
    previousLogSearchSteps: LogSearchStep[];
    lastLogSearchStep?: LogSearchStep;
    logLabelsMap: Map<string, string[]>;
    remainingQueries: number;
    codebaseOverview: string;
  }): Promise<LogSearchResponse> {
    const prompt = createLogSearchPrompt({
      ...params,
      platformSpecificInstructions: this.observabilityPlatform.getLogSearchQueryInstructions(),
    });

    try {
      const { toolCalls, text } = await generateText({
        model: this.llmClient,
        system: SYSTEM_PROMPT,
        prompt: prompt,
        tools: {
          logSearchInput: logSearchInputToolSchema,
        },
        toolChoice: "auto",
      });

      logger.info(`Log search reasoning:\n${text}`);

      // End loop if no tool calls returned, similar to Reasoner
      if (!toolCalls || toolCalls.length === 0) {
        return {
          type: "taskComplete",
          reasoning: text,
          summary: "Log search task complete",
        };
      }

      const toolCall = ensureSingleToolCall(toolCalls);

      if (toolCall.toolName === "logSearchInput") {
        return {
          type: "logSearchInput",
          ...toolCall.args,
        };
      } else {
        throw new Error(`Unexpected tool name: ${toolCall.toolName}`);
      }
    } catch (error) {
      logger.error("Error generating log search query:", error);
      // TODO: revisit fallback
      return {
        type: "logSearchInput",
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
        query: "service:orders OR service:payments OR service:tickets OR service:expiration",
        limit: 500,
        pageCursor: null,
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
    this.logSearch = new LogSearch(this.config.fastClient, this.config.observabilityPlatform);
  }

  @timer
  async invoke(params: {
    logSearchId: string;
    logRequest: string;
    maxIters?: number;
  }): Promise<LogSearchAgentResponse> {
    let response: LogSearchResponse | null = null;
    const maxIters = params.maxIters || MAX_ITERS;
    let currentIter = 0;
    let newLogSearchSteps: LogSearchStep[] = [];

    while ((!response || response.type !== "taskComplete") && currentIter < maxIters) {
      const previousLogSearchSteps = this.state.getLogSearchSteps(StepsType.BOTH);
      let lastLogSearchStep: LogSearchStep | undefined = undefined;
      if (previousLogSearchSteps.length > 0) {
        lastLogSearchStep = previousLogSearchSteps[previousLogSearchSteps.length - 1];
      }

      response = await this.logSearch.invoke({
        query: this.config.query,
        logRequest: params.logRequest,
        logLabelsMap: this.config.logLabelsMap,
        previousLogSearchSteps,
        lastLogSearchStep,
        remainingQueries: maxIters - currentIter,
        codebaseOverview: this.config.codebaseOverview,
      });

      currentIter++;

      if (response.type === "logSearchInput") {
        logger.info(
          `Searching logs with query: ${response.query} from ${response.start} to ${response.end}`
        );

        logger.info("Fetching logs from observability platform...");
        const logContext = await handleLogSearchRequest(
          response,
          this.config.observabilityPlatform
        );

        // TODO: centralize the conversion from tool result + toolcall to step
        let step: LogSearchStep;
        if (logContext.type === "error") {
          step = {
            type: "logSearch",
            timestamp: new Date(),
            input: response,
            results: logContext.error,
          };
        } else {
          step = {
            type: "logSearch",
            timestamp: new Date(),
            input: response,
            results: logContext,
          };
        }

        newLogSearchSteps.push(step);
        lastLogSearchStep = step;
        this.state.addIntermediateStep(step, params.logSearchId);

        const lastLogSearchResultsFormatted = formatLogSearchSteps([step]);
        logger.info(`Log search results:\n${lastLogSearchResultsFormatted}`);
      } else {
        logger.info("Log search complete");
      }
    }

    if (currentIter >= maxIters && (!response || response.type !== "taskComplete")) {
      logger.info(
        `Log search reached maximum iterations (${maxIters}). Completing search forcibly.`
      );
    }

    return {
      type: "logSearchAgentResponse",
      newLogSearchSteps,
    };
  }
}
