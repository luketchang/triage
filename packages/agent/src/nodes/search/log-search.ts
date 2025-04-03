import { AnthropicModel, getModelWrapper, logger, OpenAIModel } from "@triage/common";
import { Log, ObservabilityPlatform } from "@triage/observability";
import { generateText } from "ai";
import {
  LogSearchInput,
  logSearchInputToolSchema,
  TaskComplete,
  taskCompleteToolSchema,
} from "../../types";
import { formatChatHistory, formatLogResults, validateToolCalls } from "../utils";

export interface LogSearchAgentResponse {
  newLogContext: Map<LogSearchInput, Log[]>;
  summary: string;
}

export type LogSearchResponse = LogSearchInput | TaskComplete;

function createLogSearchPrompt(params: {
  query: string;
  logRequest: string; // TODO: add back in if needed
  chatHistory: string[];
  logLabelsMap: string;
  platformSpecificInstructions: string;
}): string {
  const currentTime = new Date().toISOString();

  return `
You are an expert AI assistant that helps engineers debug production issues by searching through logs. Your task is to explore/surface logs based on the issue/event.

Given all available log labels and a user query about the issue/event, your task is to fetch logs relevant to the issue/event that will give you a full picture of the issue/event. You will do so by outputting either a \`LogSearchInput\` to read logs from observability API OR a \`TaskComplete\` to indicate that you have completed your search.

Query Synthesis Instructions:
- Use a two-phase approach to log search:
  1. EXPLORATION PHASE: Start with broad service-only queries to understand overall system behavior
  2. REFINEMENT PHASE: Create targeted queries that include relevant IDs, filter noise, and capture the full issue lifecycle
- For initial exploration, use simple queries with just 2-4 related service names (e.g., "service:orders OR service:payments")
- After identifying relevant services and events, refine your queries to include:
  * Specific transaction/order/entity IDs that relate to the issue
  * Relevant time windows that span before, during, and after the issue
  * Filtering expressions to exclude noisy logs (using NOT or dash operators)
- Aim for your final queries to capture the complete story of what happened, not just error moments
- If you are not getting any results, it is okay to just give a time range and constrain the number of services being queried.
- Refer to the <platform_specific_instructions> for more information on how to formulate your query.
- Trust the platform-specific instructions over your own general knowledge about how to query logs.

Tips:
- Begin with the most basic service-only queries before adding any constraints.
- PREFER SIMPLE QUERIES at the beginning to capture a broad view of system activity.
- Avoid overly complex queries that combine multiple services with specific error messages.
- DO NOT query logs from any non-user-facing services. This includes services such as mongo, controller, agent, alloy, operator, nats, cluster-agent, desktop-vpnkit-controller, metrics-server, etc. These will add noise to results and are not helpful.
- DO filter out verbose startup, initialization, and shutdown logs that aren't related to the actual error. 
- DO filter out common service logs like "Handling request for current user" or metadata logs that don't provide useful debugging info.
- The timezone for start and end dates should be Universal Coordinated Time (UTC).
- Use "level:error" or "level:warn" to filter for error and warning logs when you're ready to focus on problems.
- Once you've found relevant logs with IDs or other identifiers, use those in follow-up queries to track specific events across services
- When you spot specific transaction IDs, order IDs, or relevant entity IDs in logs, use these to craft targeted queries
- If you're getting the same types of logs in consecutive queries, IMMEDIATELY issue TaskComplete as you're not finding new information.
- Be generous on the time ranges and give +/- 15 minutes to ensure you capture the issue/event (e.g. 4:10am to 4:40am if issue/event was at 4:25am).
- If there is source code in your previously gathered context, use it to inform your log search.

Rules:
- Output just 1 single \`LogSearchInput\` at a time. DO NOT output multiple \`LogSearchInput\`s.
- Look at the context previously gathered to see what logs you have already fetched and what queries you've tried, DO NOT repeat past queries.
- DO NOT query the same services multiple times with slightly different configurations - this wastes iterations and provides redundant information.
- Returned logs will be displayed in this format for each log line: <service> <timestamp> <content>
- If you're not finding any logs with specific error keywords, switch to service-only queries to get a system overview first.
- Output \`TaskComplete\` IMMEDIATELY if:
  * You see the same class of logs being returned in consecutive queries
  * You've already captured logs showing the key errors mentioned in the query
  * You've already seen error logs from the relevant services
  * You've gathered sufficient logs to understand the issue and error patterns
  * You've traced specific entity IDs across multiple services
  * You've captured logs from before, during, and after the issue occurred
  * Additional queries are becoming repetitive or returning similar information
  * You've tried multiple query strategies and have a comprehensive view of system behavior
  * You have sufficient information to determine the root cause of the issue

<current_time>
${currentTime}
</current_time>

<log_labels>
${params.logLabelsMap}
</log_labels>

<platform_specific_instructions>
${params.platformSpecificInstructions}
</platform_specific_instructions>

Use the below history of context you already gathered to inform what steps you will take next. DO NOT make the same query twice, it is a waste of the context window.

<query>
${params.query}
</query>

<context_previously_gathered>
${formatChatHistory(params.chatHistory)}
</context_previously_gathered>
`;
}

function createLogSearchSummaryPrompt(params: {
  query: string;
  logResults: Map<LogSearchInput, Log[]>;
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
  private llm: OpenAIModel | AnthropicModel;
  private observabilityPlatform: ObservabilityPlatform;

  constructor(llm: OpenAIModel | AnthropicModel, observabilityPlatform: ObservabilityPlatform) {
    this.llm = llm;
    this.observabilityPlatform = observabilityPlatform;
  }

  async invoke(params: {
    query: string;
    logRequest: string;
    chatHistory: string[];
    logLabelsMap: string;
  }): Promise<LogSearchResponse> {
    const prompt = createLogSearchPrompt({
      ...params,
      platformSpecificInstructions: this.observabilityPlatform.getLogSearchQueryInstructions(),
    });

    try {
      const { toolCalls } = await generateText({
        model: getModelWrapper(this.llm),
        prompt: prompt,
        tools: {
          logSearchInput: logSearchInputToolSchema,
          taskComplete: taskCompleteToolSchema,
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
  private fastModel: OpenAIModel | AnthropicModel;
  private reasoningModel: OpenAIModel | AnthropicModel;
  private observabilityPlatform: ObservabilityPlatform;
  private logSearch: LogSearch;

  constructor(
    fastModel: OpenAIModel | AnthropicModel,
    reasoningModel: OpenAIModel | AnthropicModel,
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
    chatHistory: string[];
    maxIters?: number;
  }): Promise<LogSearchAgentResponse> {
    let chatHistory: string[] = params.chatHistory;
    let logResults: Map<LogSearchInput, Log[]> = new Map();
    let response: LogSearchResponse | null = null;
    const maxIters = params.maxIters || 10;
    let currentIter = 0;

    while ((!response || response.type !== "taskComplete") && currentIter < maxIters) {
      response = await this.logSearch.invoke({
        query: params.query,
        logRequest: params.logRequest,
        chatHistory: chatHistory,
        logLabelsMap: params.logLabelsMap,
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

          const formattedLogs = formatLogResults(new Map([[response, logContext]]));

          logger.info(`Log search results:\n${formattedLogs}`);
          logger.info(`Log search reasoning:\n${response.reasoning}`);

          logResults.set(response, logContext);

          chatHistory = [
            ...chatHistory,
            `Query: ${response.query}.\nStart: ${response.start}.\nEnd: ${response.end}.\nLimit: ${response.limit}.\nLog search results:\n${formattedLogs}\nReasoning:\n${response.reasoning}`,
          ];
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error executing log search: ${errorMessage}`);
          chatHistory = [...chatHistory, `Error executing log search: ${errorMessage}`];
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

    const summaryPrompt = createLogSearchSummaryPrompt({
      query: params.query,
      logResults,
    });

    // const { text } = await generateText({
    //   model: getModelWrapper(this.reasoningModel),
    //   prompt: summaryPrompt,
    // });

    logger.info(`Log search summary:\n${""}`);

    return {
      newLogContext: logResults,
      summary: "",
    };
  }
}
