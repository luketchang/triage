import { getModelWrapper, logger, Model } from "@triage/common";
import { Log, ObservabilityPlatform } from "@triage/observability";
import { generateText } from "ai";
import { LogSearchInput, logSearchInputToolSchema, TaskComplete } from "../../types";
import { formatLogResults, validateToolCalls } from "../utils";

export interface LogSearchAgentResponse {
  newLogContext: Map<LogSearchInput, Log[] | string>;
  queryHistory: Map<LogSearchInput, Log[] | string>;
  summary: string;
}

export type LogSearchResponse = LogSearchInput | TaskComplete;

const SYSTEM_PROMPT = `
You are an expert AI assistant that helps engineers debug production issues by searching through logs. Your task is to find logs relevant to the issue/event.
`;

function createLogSearchPrompt(params: {
  query: string;
  logRequest: string; // TODO: add back in if needed
  logResultHistory: Map<LogSearchInput, Log[] | string>;
  logLabelsMap: string;
  platformSpecificInstructions: string;
  previousLogQueryResult?: { input: LogSearchInput; logs: Log[] | string };
}): string {
  const currentTime = new Date().toISOString();

  // Format the previous log query result for display
  const formattedPreviousResult = params.previousLogQueryResult
    ? formatLogResults(
        new Map([[params.previousLogQueryResult.input, params.previousLogQueryResult.logs]])
      )
    : "";

  return `
Given all available log labels and a user query about the issue/event, your task is to fetch logs relevant to the issue/event that will give you a full picture of the issue/event. You will do so by outputting \`LogSearchInput\` outputs to read logs from observability API.

## Tips
- DO NOT query logs from non-user-facing services. This includes services such as mongo, controller, agent, alloy, operator, nats, cluster-agent, desktop-vpnkit-controller, metrics-server, etcd, redis, etc (think anything collector or infrastructure related).
- Early on in exploration, tag multiple services in your queries instead of doing multiple searches each with one service tagged.
- As you make queries, pay attention to the results in <previous_log_query_result> to see the results of your last query and <log_results_history> to see the results of all previous queries. You should make decisions on future queries based on the results of your previous queries.
- As you find log results indicative of the exact issue/event, you should try to find preceding logs that explain how/why that issue/event is related to the user query.
- Your goal is to eventually find a query that returns logs across the related services with as much important surrounding context and events as possible. All log results fetched at the end of your log search iterations will be merged together to form a complete picture of the issue/event.
- Do not filter on random keywords. Random is anything that is not one of the following: service name, part of an error message, an ID, or a known keyword that is directly critical to the issue/event occurring.
- Do not filter on code snippets (e.g. file names, classes, methods, component tags, etc).
- If you are getting empty log results, try the following:
  - Shorten keyword filters
  - Remove keyword filters
  - Use attribute filters in place of plain keyword filters
  - Widen time range
  - Add more services to the query

## Rules:
- Output just 1 single \`LogSearchInput\` at a time. DO NOT output multiple \`LogSearchInput\`s.
- Look at the context previously gathered to see what logs you have already fetched and what queries you've tried, DO NOT repeat past queries.
- DO NOT query the same services multiple times with slightly different configurations - this wastes iterations and provides redundant information.
- If you're not finding any logs with specific error keywords, switch to service-only queries to get a system overview first.

<current_time>
${currentTime}
</current_time>

<query>
${params.query}
</query>

<log_labels>
${params.logLabelsMap}
</log_labels>

<platform_specific_instructions>
${params.platformSpecificInstructions}
</platform_specific_instructions>

<previous_log_query_result>
${formattedPreviousResult}
</previous_log_query_result>

<log_results_history>
${formatLogResults(params.logResultHistory)}
</log_results_history>
`;
}

function createLogSearchSummaryPrompt(params: {
  query: string;
  logResults: Map<LogSearchInput, Log[] | string>;
}): string {
  const currentTime = new Date().toISOString();

  return `
Given a set of log queries and the fetched log results, concisely summarize the main findings as they pertain to the provided user query and how we may debug the issue/event. 

Focus on capturing the full sequence of system events from BEFORE, DURING, and AFTER any errors or issues. Look for patterns in the logs that would help understand:
1. The normal system behavior and message flows between services
2. Critical events leading up to any errors
3. The response of the system after errors occurred
4. How different services interact with each other (especially messaging patterns)
5. Key transaction/entity IDs that appear across multiple services

Provide a detailed analysis that:
- Identifies specific entity IDs (order IDs, transaction IDs, message IDs) that are relevant to the issue
- Traces how these entities moved through different services over time
- Highlights where errors or unexpected behavior occurred
- Connects related events across different services
- Shows the complete lifecycle of important transactions

Your response should be a chronological sequence of significant events observed through the logs that are relevant to the user query, including service interactions, startup sequences, message passing, and error conditions. The response should provide an accurate, objective summary of what the logs show without being speculative.

<current_time>
${currentTime}
</current_time>

<query>
${params.query}
</query>

<log_results>
${formatLogResults(params.logResults)}
</log_results>
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
    logResultHistory: Map<LogSearchInput, Log[] | string>;
    logLabelsMap: string;
    previousLogQueryResult?: { input: LogSearchInput; logs: Log[] | string };
  }): Promise<LogSearchResponse> {
    const prompt = createLogSearchPrompt({
      ...params,
      platformSpecificInstructions: this.observabilityPlatform.getLogSearchQueryInstructions(),
    });

    // logger.info(`Log search prompt:\n${prompt}`);

    try {
      const { toolCalls } = await generateText({
        model: getModelWrapper(this.llm),
        system: SYSTEM_PROMPT,
        prompt: prompt,
        tools: {
          logSearchInput: logSearchInputToolSchema,
          // taskComplete: taskCompleteToolSchema,
        },
        toolChoice: "required",
      });

      const toolCall = validateToolCalls(toolCalls);

      if (toolCall.toolName === "logSearchInput") {
        return {
          type: "logSearchInput",
          ...toolCall.args,
        };
      } else {
        return {
          type: "taskComplete",
          ...toolCall.args,
        };
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
        reasoning:
          "Failed to generate query with LLM. Using fallback query to get a broad view of microservices.",
      };
    }
  }
}

export class LogSearchAgent {
  private fastModel: Model;
  private reasoningModel: Model;
  private observabilityPlatform: ObservabilityPlatform;
  private logSearch: LogSearch;

  constructor(
    fastModel: Model,
    reasoningModel: Model,
    observabilityPlatform: ObservabilityPlatform
  ) {
    this.fastModel = fastModel;
    this.reasoningModel = reasoningModel;
    this.observabilityPlatform = observabilityPlatform;
    this.logSearch = new LogSearch(fastModel, observabilityPlatform);
  }

  async invoke(params: {
    query: string;
    logRequest: string;
    logLabelsMap: string;
    logResultHistory?: Map<LogSearchInput, Log[] | string>;
    maxIters?: number;
  }): Promise<LogSearchAgentResponse> {
    // Convert string[] logResultHistory to Map if needed, or create empty map if not provided
    let logResultHistory: Map<LogSearchInput, Log[] | string>;
    if (!params.logResultHistory) {
      logResultHistory = new Map();
    } else {
      logResultHistory = params.logResultHistory;
    }

    // Variable to store the previous query result (initially undefined)
    let previousLogResult: { query: LogSearchInput; logs: Log[] | string } | undefined = undefined;

    let response: LogSearchResponse | null = null;
    const maxIters = params.maxIters || 30;
    let currentIter = 0;

    while ((!response || response.type !== "taskComplete") && currentIter < maxIters) {
      // Convert previousLogResult to the format expected by LogSearch
      const previousLogQueryResult = previousLogResult
        ? { input: previousLogResult.query, logs: previousLogResult.logs }
        : undefined;

      response = await this.logSearch.invoke({
        query: params.query,
        logRequest: params.logRequest,
        logLabelsMap: params.logLabelsMap,
        logResultHistory: logResultHistory,
        previousLogQueryResult: previousLogQueryResult,
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

          // Add previous result to log history if it exists
          if (previousLogResult) {
            logResultHistory.set(previousLogResult.query, previousLogResult.logs);
          }

          // Add current query to history
          logResultHistory.set(response, logContext);

          // Set current result as previous for next iteration
          previousLogResult = {
            query: response,
            logs: logContext,
          };

          // Log the current query results
          const currentQueryFormatted = formatLogResults(new Map([[response, logContext]]));
          logger.info(`Log search results:\n${currentQueryFormatted}`);
          logger.info(`Log search reasoning:\n${response.reasoning}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error executing log search: ${errorMessage}`);

          // Store error message in log history
          if (response) {
            previousLogResult = {
              query: response,
              logs: errorMessage,
            };
          }
        }
      } else {
        logger.info("Log search complete");

        // Add the last query to log history if it exists
        if (previousLogResult) {
          logResultHistory.set(previousLogResult.query, previousLogResult.logs);
        }
      }
    }

    if (currentIter >= maxIters && (!response || response.type !== "taskComplete")) {
      logger.info(
        `Log search reached maximum iterations (${maxIters}). Completing search forcibly.`
      );

      // Add the last query to log history if it exists and wasn't added already
      if (previousLogResult) {
        logResultHistory.set(previousLogResult.query, previousLogResult.logs);
      }
    }

    const summaryPrompt = createLogSearchSummaryPrompt({
      query: params.query,
      logResults: logResultHistory,
    });

    // logger.info("Generating log search summary...");
    // const { text } = await generateText({
    //   model: getModelWrapper(this.reasoningModel),
    //   prompt: summaryPrompt,
    // });

    // logger.info(`Log search summary:\n${text}`);

    return {
      newLogContext: logResultHistory,
      queryHistory: logResultHistory,
      summary: "TODO",
    };
  }
}
