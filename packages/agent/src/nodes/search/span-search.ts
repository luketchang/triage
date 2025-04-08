import { getModelWrapper, logger, Model } from "@triage/common";
import { ObservabilityPlatform, SpansWithPagination } from "@triage/observability";
import { generateText } from "ai";
import {
  SpanSearchInput,
  spanSearchInputToolSchema,
  TaskComplete,
  taskCompleteToolSchema,
} from "../../types";
import { ensureSingleToolCall, formatChatHistory, formatSpanResults } from "../utils";

export interface SpanSearchAgentResponse {
  newSpanContext: Map<SpanSearchInput, SpansWithPagination | string>;
  summary: string;
}

export type SpanSearchResponse = SpanSearchInput | TaskComplete;

function createSpanSearchPrompt(params: {
  query: string;
  spanRequest: string;
  chatHistory: string[];
  spanLabelsMap: string;
  platformSpecificInstructions: string;
}): string {
  const currentTime = new Date().toISOString();

  return `
You are an expert AI assistant that assists engineers debugging production issues. You specifically help by finding spans relevant to the user's query and a description of what types of spans are needed.

Given a request for the type of spans needed for the investigation, your task is to fetch spans relevant to the request. You will do so by outputting your intermediate reasoning for explaining what action you will take and then outputting either a \`SpanSearchInput\` to read spans from observability API OR a \`TaskComplete\` to indicate that you have completed the request.

Guidelines:
- Spans are distributed traces that show the flow of requests through microservices
- Every span query must include at least one service name or other identifier
- The timezone for start and end dates should be Universal Coordinated Time (UTC)
- If span search is not returning results (as may show in message history), adjust/widen query as needed
- Be generous on the time ranges and give +/- 15 minutes to ensure you capture the issue
- If there is source code in your previously gathered context, use it to inform your span search
- DO NOT output \`TaskComplete\` until you have a broad view of spans captured at least once
- Use the labels provided to inform your span search using the query language required by the platform
- Refer to the <platform_specific_instructions> for more information on how to formulate your query

Rules:
- Output just 1 single \`SpanSearchInput\` at a time. DO NOT output multiple \`SpanSearchInput\`s.
- Look at the context previously gathered to see what spans you have already fetched and what queries you've tried, DO NOT repeat past queries

Use the below history of context you already gathered to inform what steps you will take next. DO NOT make the same query twice, it is a waste of the context window.

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

<context_previously_gathered>
${formatChatHistory(params.chatHistory)}
</context_previously_gathered>
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
    chatHistory: string[];
    spanLabelsMap: string;
  }): Promise<SpanSearchResponse> {
    const prompt = createSpanSearchPrompt({
      ...params,
      platformSpecificInstructions: this.observabilityPlatform.getSpanSearchQueryInstructions(),
    });

    try {
      const { toolCalls } = await generateText({
        model: getModelWrapper(this.llm),
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
    chatHistory: string[];
    maxIters?: number;
  }): Promise<SpanSearchAgentResponse> {
    let chatHistory: string[] = params.chatHistory;
    let spanResults: Map<SpanSearchInput, SpansWithPagination | string> = new Map();
    let response: SpanSearchResponse | null = null;
    const maxIters = params.maxIters || 10;
    let currentIter = 0;

    while ((!response || response.type !== "taskComplete") && currentIter < maxIters) {
      response = await this.spanSearch.invoke({
        query: params.query,
        spanRequest: params.spanRequest,
        chatHistory: chatHistory,
        spanLabelsMap: params.spanLabelsMap,
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

          spanResults.set(response, spansWithPagination);

          chatHistory = [
            ...chatHistory,
            `Query: ${response.query}.\nStart: ${response.start}.\nEnd: ${response.end}.\nLimit: ${response.pageLimit}.\nSpan search results: ${spansWithPagination.spans.length} spans found.\nPage Cursor Or Indicator: ${spansWithPagination.pageCursorOrIndicator || "None"}.\nReasoning:\n${response.reasoning}`,
          ];
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error executing span search: ${errorMessage}`);
          spanResults.set(response, errorMessage);
          chatHistory = [...chatHistory, `Error executing span search: ${errorMessage}`];
        }
      } else {
        logger.info("Span search complete");
      }
    }

    // If we've reached maxIters and still don't have a taskComplete, create one with an explanation
    if (currentIter >= maxIters && (!response || response.type !== "taskComplete")) {
      logger.info(
        `Span search reached maximum iterations (${maxIters}). Completing search forcibly.`
      );
    }

    const summaryPrompt = createSpanSearchSummaryPrompt({
      query: params.query,
      spanResults,
    });

    const { text } = await generateText({
      model: getModelWrapper(this.reasoningModel),
      prompt: summaryPrompt,
    });

    logger.info(`Span search summary:\n${text}`);

    return {
      newSpanContext: spanResults,
      summary: text,
    };
  }
}
