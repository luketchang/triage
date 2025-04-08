import { getModelWrapper, logger, Model } from "@triage/common";
import { ObservabilityPlatform, SpansWithPagination } from "@triage/observability";
import { generateText } from "ai";
import {
  SpanSearchInput,
  spanSearchInputToolSchema,
  TaskComplete,
  taskCompleteToolSchema,
} from "../../types";
import { ensureSingleToolCall, formatSpanResults } from "../utils";

export interface SpanSearchAgentResponse {
  newSpanContext: Map<SpanSearchInput, SpansWithPagination | string>;
  summary: string;
}

export type SpanSearchResponse = SpanSearchInput | TaskComplete;

const MAX_ITERS = 10;

const SYSTEM_PROMPT = `
You are an expert AI assistant that helps engineers debug production issues by searching through distributed traces. Your task is to find spans relevant to the issue/event.
`;

function createSpanSearchPrompt(params: {
  query: string;
  spanRequest: string;
  spanResultHistory: Map<SpanSearchInput, SpansWithPagination | string>;
  spanLabelsMap: string;
  platformSpecificInstructions: string;
  previousSpanQueryResult?: {
    input: SpanSearchInput;
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

  return `
You are an expert AI assistant that assists engineers debugging production issues. You specifically help by finding spans relevant to the user's query and a description of what types of spans are needed.

Given a request for the type of spans needed for the investigation, your task is to fetch spans relevant to the request. You will do so by outputting your intermediate reasoning for explaining what action you will take and then outputting a \`SpanSearchInput\` to read spans from observability API.

Guidelines:
- Spans are distributed traces that show the flow of requests through microservices
- Every span query must include at least one service name or other identifier
- The timezone for start and end dates should be Universal Coordinated Time (UTC)
- If span search is not returning results (as may show in previous results), adjust/widen query as needed
- Be generous on the time ranges and give +/- 15 minutes to ensure you capture the issue
- If there is source code in your previously gathered context, use it to inform your span search
- DO NOT output \`TaskComplete\` until you have a broad view of spans captured at least once
- Use the labels provided to inform your span search using the query language required by the platform
- Refer to the <platform_specific_instructions> for more information on how to formulate your query

Rules:
- Output just 1 single \`SpanSearchInput\` at a time. DO NOT output multiple \`SpanSearchInput\`s.
- Look at the span result history to see what spans you have already fetched and what queries you've tried, DO NOT repeat past queries.

<remaining_queries>
${params.remainingQueries}
</remaining_queries>

<current_time>
${currentTime}
</current_time>

<query>
${params.query}
</query>

<labels>
${params.spanLabelsMap}
</labels>

<platform_specific_instructions>
${params.platformSpecificInstructions}
</platform_specific_instructions>

<span_request>
${params.spanRequest}
</span_request>

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
  spanResults: Map<SpanSearchInput, SpansWithPagination | string>;
}): string {
  const currentTime = new Date().toISOString();

  return `
Given a set span queries and the fetched span results, concisely summarize the main findings as they pertain to the provided user query and how we may debug the issue/event. Your response just be a short sequence of events you've observed through the spans that are relevant to the user query. The response should not be speculative about any root causes or further issues—it should objectively summarize what the spans show.


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
    spanResultHistory: Map<SpanSearchInput, SpansWithPagination | string>;
    spanLabelsMap: string;
    previousSpanQueryResult?: {
      input: SpanSearchInput;
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
          taskComplete: taskCompleteToolSchema,
        },
        toolChoice: "required",
      });

      const toolCall = ensureSingleToolCall(toolCalls);

      if (toolCall.toolName === "spanSearchInput") {
        return {
          type: "spanSearchInput",
          ...toolCall.args,
        };
      } else {
        return {
          type: "taskComplete",
          ...toolCall.args,
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
    spanResultHistory?: Map<SpanSearchInput, SpansWithPagination | string>;
    maxIters?: number;
  }): Promise<SpanSearchAgentResponse> {
    // Convert spanResultHistory to Map if provided or create empty map
    let spanResultHistory: Map<SpanSearchInput, SpansWithPagination | string>;
    if (!params.spanResultHistory) {
      spanResultHistory = new Map();
    } else {
      spanResultHistory = params.spanResultHistory;
    }

    // Variable to store the previous query result (initially undefined)
    let previousSpanResult:
      | { input: SpanSearchInput; spans: SpansWithPagination | string }
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

          // Create a simplified version for logging (not the full formatSingleSpan output)
          const formattedSpans = formatSpanResults(new Map([[response, spansWithPagination]]));

          logger.info(`Span search results:\n${formattedSpans}`);
          logger.info(`Span search reasoning:\n${response.reasoning}`);

          // Add previous result to span history if it exists
          if (previousSpanResult) {
            spanResultHistory.set(previousSpanResult.input, previousSpanResult.spans);
          }

          // Set current result as previous for next iteration
          previousSpanResult = {
            input: response,
            spans: spansWithPagination,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error executing span search: ${errorMessage}`);

          // Store error message in span history
          if (response) {
            previousSpanResult = {
              input: response,
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
