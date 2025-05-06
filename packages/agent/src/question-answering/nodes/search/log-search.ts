import { getModelWrapper, logger, Model, timer } from "@triage/common";
import { ObservabilityPlatform } from "@triage/observability";
import { generateText } from "ai";
import { v4 as uuidv4 } from "uuid";

import { AgentStreamUpdate, LogSearchInput, logSearchInputToolSchema, LogSearchStep, TaskComplete } from "../types";

import { ensureSingleToolCall, formatFacetValues, formatLogSearchSteps } from "./utils";

export interface LogSearchAgentResponse {
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
  private llm: Model;
  private observabilityPlatform: ObservabilityPlatform;

  constructor(llm: Model, observabilityPlatform: ObservabilityPlatform) {
    this.llm = llm;
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
        model: getModelWrapper(this.llm),
        system: SYSTEM_PROMPT,
        prompt: prompt,
        tools: {
          logSearchInput: logSearchInputToolSchema,
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
        reasoning:
          "Failed to generate query with LLM. Using fallback query to get a broad view of microservices.",
      };
    }
  }
}

export class LogSearchAgent {
  private observabilityPlatform: ObservabilityPlatform;
  private logSearch: LogSearch;

  constructor(fastModel: Model, observabilityPlatform: ObservabilityPlatform) {
    this.observabilityPlatform = observabilityPlatform;
    this.logSearch = new LogSearch(fastModel, observabilityPlatform);
  }

  @timer
  async invoke(params: {
    logSearchId: string;
    query: string;
    logRequest: string;
    logLabelsMap: Map<string, string[]>;
    logSearchSteps: LogSearchStep[];
    maxIters?: number;
    codebaseOverview: string;
    onUpdate?: (update: AgentStreamUpdate) => void;
  }): Promise<LogSearchAgentResponse> {
    // Variable to store the previous query result (initially undefined)
    let previousLogSearchSteps = params.logSearchSteps;
    let lastLogSearchStep: LogSearchStep | undefined = undefined;

    let response: LogSearchResponse | null = null;
    const maxIters = params.maxIters || MAX_ITERS;
    let currentIter = 0;

    let newLogSearchSteps: LogSearchStep[] = [];
    while ((!response || response.type !== "taskComplete") && currentIter < maxIters) {
      response = await this.logSearch.invoke({
        query: params.query,
        logRequest: params.logRequest,
        logLabelsMap: params.logLabelsMap,
        previousLogSearchSteps,
        lastLogSearchStep,
        remainingQueries: maxIters - currentIter,
        codebaseOverview: params.codebaseOverview,
      });

      currentIter++;

      if (response.type === "logSearchInput") {
        logger.info(
          `Searching logs with query: ${response.query} from ${response.start} to ${response.end}`
        );

        try {
          logger.info("Fetching logs from observability platform...");
          const logContext = await this.observabilityPlatform.fetchLogs({
            query: response.query,
            start: response.start,
            end: response.end,
            limit: response.limit,
          });

          const step: LogSearchStep = {
            type: "logSearch",
            timestamp: new Date(),
            input: response,
            results: logContext,
          };

          if (params.onUpdate) {
            params.onUpdate({
              type: "intermediateUpdate",
              id: uuidv4(),
              parentId: params.logSearchId,
              step: step,
            });
          }

          previousLogSearchSteps.push(step);
          newLogSearchSteps.push(step);
          lastLogSearchStep = step;

          const lastLogSearchResultsFormatted = formatLogSearchSteps([lastLogSearchStep]);
          logger.info(`Log search results:\n${lastLogSearchResultsFormatted}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error executing log search: ${errorMessage}`);

          // Store error message in log history (without reasoning)
          if (response) {
            lastLogSearchStep = {
              type: "logSearch",
              input: response,
              results: errorMessage,
              timestamp: new Date(),
            };
          }
        }
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
      newLogSearchSteps,
    };
  }
}
