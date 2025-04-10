import { getModelWrapper, logger, Model } from "@triage/common";
import { ObservabilityPlatform, SpansWithPagination } from "@triage/observability";
import { generateText } from "ai";
import {
  SpanSearchInput,
  SpanSearchInputCore,
  spanSearchInputToolSchema,
  stripReasoning,
  TaskComplete,
} from "../../types";
import { ensureSingleToolCall, formatSpanResults } from "../utils";

export interface SpanSearchAgentResponse {
  newSpanContext: Map<SpanSearchInputCore, SpansWithPagination | string>;
  summary: string;
}

export type SpanSearchResponse = SpanSearchInput | TaskComplete;

const MAX_ITERS = 5;

const SYSTEM_PROMPT = `
You are an expert AI assistant that helps engineers debug production issues by searching through distributed traces/spans. Your task is to find spans relevant to the issue/event.
`;

function createSpanSearchPrompt(params: {
  query: string;
  spanRequest: string;
  spanResultHistory: Map<SpanSearchInputCore, SpansWithPagination | string>;
  spanLabelsMap: string;
  platformSpecificInstructions: string;
  previousSpanQueryResult?: {
    input: SpanSearchInputCore;
    spans: SpansWithPagination | string;
  };
  remainingQueries: number;
}): string {
  const currentTime = new Date().toISOString();

  // Format the previous span query result for display
  const formattedPreviousResult = params.previousSpanQueryResult
    ? formatSpanResults(
        new Map([[params.previousSpanQueryResult.input, params.previousSpanQueryResult.spans]])
      )
    : "";

  // TODO: consider removing this
  return `
Given all available span labels and a user query about the issue/event, your task is to fetch spans (distributed traces) for the following objective: ${params.spanRequest}. You will do so by outputting \`SpanSearchInput\` outputs to read spans from the observability API.

## Tips
- DO NOT query spans from non-user-facing services. This includes services such as mongo, controller, agent, alloy, operator, nats, cluster-agent, desktop-vpnkit-controller, metrics-server, etcd, redis, etc (think anything collector or infrastructure related).
- In early exploration, tag multiple services in your queries instead of doing multiple searches each with one service tagged.
- As you make queries, pay attention to the results in <previous_span_query_result> to see the results of your last query and <span_results_history> to see all previous queries. You should make decisions on future queries based on previous results.
- Look for important identifiers such as user or object IDs in spans to use in future queries.
- If you find spans indicative of an issue/event, try to find preceding spans that explain how/why it occurred.
- For at least one query, zoom out and remove most filters to get a broader view of the system (but don't overdo it - if there are too many spans it will time out).
- Your goal is to eventually find spans across related services with important surrounding context and events.
- All span results fetched at the end of your span search iterations will be merged together to form a complete picture of the issue/event.
- The span format includes:
  - The name field is usually "service_name/span_name" or just "span_name"
  - Span Name: the operation name (e.g., "process_booking", "create_payment")
  - Service name: the name of the service that generated the span
  - Parent span ID: if present, indicates this is a child span
  - Trace ID: used to identify related spans in a trace
  - Duration: how long the operation took
  - Status: success/error/other outcome
  - Attributes: key-value pairs with span metadata like HTTP codes, payload sizes, etc.

## Rules
- Output one \`SpanSearchInput\` at a time. DO NOT output multiple \`SpanSearchInput\` tool calls.
- Look at the context previously gathered to see what spans you already have, DO NOT repeat past queries.
- DO NOT query the same services multiple times with slightly different configurations - this wastes iterations.

<remaining_queries>
${params.remainingQueries}
</remaining_queries>

<current_time>
${currentTime}
</current_time>

<query>
${params.query}
</query>

<span_labels>
${params.spanLabelsMap}
</span_labels>

<platform_specific_instructions>
${params.platformSpecificInstructions}
</platform_specific_instructions>

<previous_span_query_result>
${formattedPreviousResult}
</previous_span_query_result>

<span_results_history>
${formatSpanResults(params.spanResultHistory)}
</span_results_history>
`;
}

function createSpanSearchSummaryPrompt(params: {
  query: string;
  spanResults: Map<SpanSearchInputCore, SpansWithPagination | string>;
}): string {
  const currentTime = new Date().toISOString();

  return `
Given a set of span queries and the fetched span results, concisely summarize the main findings as they pertain to the provided user query and how we may debug the issue/event.

Focus on:
1. Identifying the call flow across services
2. Request paths and data flow patterns
3. Error patterns and failure modes
4. Performance bottlenecks (high latency)
5. Key transaction IDs or correlation IDs

Provide a detailed analysis that:
- Traces the full execution flow through the system
- Identifies where errors or latency issues occurred
- Connects related events across different services
- Shows the complete lifecycle of important transactions

Your response should be a chronological sequence of significant events observed through the spans that are relevant to the user query, including service interactions, timing, and error conditions.

<current_time>
${currentTime}
</current_time>

<query>
${params.query}
</query>

<span_results>
${formatSpanResults(params.spanResults)}
</span_results>
`;
}

class SpanSearch {
  private llm: Model;
  private observabilityPlatform: ObservabilityPlatform;

  constructor(llm: Model, observabilityPlatform: ObservabilityPlatform) {
    this.llm = llm;
    this.observabilityPlatform = observabilityPlatform;
  }

  async invoke(params: {
    query: string;
    spanRequest: string;
    spanResultHistory: Map<SpanSearchInputCore, SpansWithPagination | string>;
    spanLabelsMap: string;
    previousSpanQueryResult?: {
      input: SpanSearchInputCore;
      spans: SpansWithPagination | string;
    };
    remainingQueries: number;
  }): Promise<SpanSearchResponse> {
    const prompt = createSpanSearchPrompt({
      ...params,
      platformSpecificInstructions: this.observabilityPlatform.getSpanSearchQueryInstructions(),
    });

    try {
      const { toolCalls } = await generateText({
        model: getModelWrapper(this.llm),
        system: SYSTEM_PROMPT,
        prompt: prompt,
        tools: {
          spanSearchInput: spanSearchInputToolSchema,
          // taskComplete: taskCompleteToolSchema,
        },
        toolChoice: "required",
      });

      const toolCall = ensureSingleToolCall(toolCalls);

      if (toolCall.toolName === "spanSearchInput") {
        return {
          ...toolCall.args,
          type: "spanSearchInput",
        };
      } else {
        // TODO: revisit once TaskComplete is turned back on
        return {
          type: "taskComplete",
          reasoning: "Task complete based on current results",
          summary: "Span search task complete",
        };
      }
    } catch (error) {
      logger.error("Error generating span search query:", error);
      // TODO: revisit fallback
      return {
        type: "spanSearchInput",
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
        query: "status:error",
        pageLimit: 100,
        pageCursor: null,
        reasoning: "Failed to generate query with LLM. Using fallback query.",
      };
    }
  }
}

export class SpanSearchAgent {
  private fastModel: Model;
  private reasoningModel: Model;
  private observabilityPlatform: ObservabilityPlatform;
  private spanSearch: SpanSearch;

  constructor(
    fastModel: Model,
    reasoningModel: Model,
    observabilityPlatform: ObservabilityPlatform
  ) {
    this.fastModel = fastModel;
    this.reasoningModel = reasoningModel;
    this.observabilityPlatform = observabilityPlatform;
    this.spanSearch = new SpanSearch(fastModel, observabilityPlatform);
  }

  async invoke(params: {
    query: string;
    spanRequest: string;
    spanLabelsMap: string;
    spanResultHistory?: Map<SpanSearchInputCore, SpansWithPagination | string>;
    maxIters?: number;
  }): Promise<SpanSearchAgentResponse> {
    // Convert spanResultHistory to Map if provided or create empty map
    let spanResultHistory: Map<SpanSearchInputCore, SpansWithPagination | string>;
    if (!params.spanResultHistory) {
      spanResultHistory = new Map();
    } else {
      spanResultHistory = params.spanResultHistory;
    }

    // Variable to store the previous query result (initially undefined)
    let previousSpanResult:
      | { input: SpanSearchInputCore; spans: SpansWithPagination | string }
      | undefined = undefined;

    let response: SpanSearchResponse | null = null;
    const maxIters = params.maxIters || MAX_ITERS;
    let currentIter = 0;

    while ((!response || response.type !== "taskComplete") && currentIter < maxIters) {
      // Convert previousSpanResult to the format expected by SpanSearch
      const previousSpanQueryResult = previousSpanResult
        ? { input: previousSpanResult.input, spans: previousSpanResult.spans }
        : undefined;

      response = await this.spanSearch.invoke({
        query: params.query,
        spanRequest: params.spanRequest,
        spanResultHistory: spanResultHistory,
        spanLabelsMap: params.spanLabelsMap,
        previousSpanQueryResult: previousSpanQueryResult,
        remainingQueries: maxIters - currentIter,
      });

      currentIter++;

      if (response.type === "spanSearchInput") {
        logger.info(`Executing span query: ${response.query}`);
        logger.info(`Time range: ${response.start} to ${response.end}`);
        logger.info(`Limit: ${response.pageLimit}`);

        try {
          logger.info("Fetching spans from observability platform...");
          const spansWithPagination = await this.observabilityPlatform.fetchSpans({
            query: response.query,
            start: response.start,
            end: response.end,
            limit: response.pageLimit,
          });

          const strippedResponse = stripReasoning(response);
          const formattedSpans = formatSpanResults(
            new Map([[strippedResponse, spansWithPagination]])
          );

          logger.info(`Span search results:\n${formattedSpans}`);
          logger.info(`Span search reasoning:\n${response.reasoning}`);

          // Add previous result to span history if it exists
          if (previousSpanResult) {
            spanResultHistory.set(previousSpanResult.input, previousSpanResult.spans);
          }

          // Set current result as previous for next iteration (without reasoning)
          previousSpanResult = {
            input: strippedResponse,
            spans: spansWithPagination,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error executing span search: ${errorMessage}`);

          // Store error message in span history (without reasoning)
          if (response) {
            const strippedResponse = stripReasoning(response);
            previousSpanResult = {
              input: strippedResponse,
              spans: errorMessage,
            };
          }
        }
      } else {
        logger.info("Span search complete");

        // Add the last query to span history if it exists
        if (previousSpanResult) {
          spanResultHistory.set(previousSpanResult.input, previousSpanResult.spans);
        }
      }
    }

    // If we've reached maxIters and still don't have a taskComplete, create one with an explanation
    if (currentIter >= maxIters && (!response || response.type !== "taskComplete")) {
      logger.info(
        `Span search reached maximum iterations (${maxIters}). Completing search forcibly.`
      );

      // Add the last query to span history if it exists and wasn't added already
      if (previousSpanResult) {
        spanResultHistory.set(previousSpanResult.input, previousSpanResult.spans);
      }
    }

    const summaryPrompt = createSpanSearchSummaryPrompt({
      query: params.query,
      spanResults: spanResultHistory,
    });

    const { text } = await generateText({
      model: getModelWrapper(this.reasoningModel),
      prompt: summaryPrompt,
    });

    logger.info(`Span search summary:\n${text}`);

    return {
      newSpanContext: spanResultHistory,
      summary: text,
    };
  }
}
