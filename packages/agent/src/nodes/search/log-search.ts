import { AnthropicModel, getModelWrapper, logger, OpenAIModel } from "@triage/common";
import { ObservabilityPlatform } from "@triage/observability";
import { generateText } from "ai";
import {
  LogSearchInput,
  logSearchInputToolSchema,
  TaskComplete,
  taskCompleteToolSchema,
} from "../../types";
import { formatChatHistory, formatLogResults, validateToolCalls } from "../utils";

export interface LogSearchAgentResponse {
  newLogContext: Map<LogSearchInput, string>;
  summary: string;
}

export type LogSearchResponse = LogSearchInput | TaskComplete;

function createLogSearchPrompt(params: {
  query: string;
  logRequest: string;
  chatHistory: string[];
  labelsMap: string;
  platformSpecificInstructions: string;
}): string {
  const currentTime = new Date().toISOString();

  return `
You are an expert AI assistant that helps engineers debug production issues by searching through logs. Your task is to explore/surface logs based on the request.

Given a request for the type of logs needed for the investigation and all available log labels, your task is to fetch logs relevant to the request. You will do so by outputting your intermediate reasoning for explaining what action you will take and then outputting either a \`LogSearchInput\` to read logs from observability API OR a \`TaskComplete\` to indicate that you have completed the request.

Query Synthesis Instructions:
- Keep the keywords and regexes simple
- Avoid speculating on keywords or phrases that are not directly related to the user's query, do not assume the existence of keywords/phrases unless its specified in the query or you have seen it in previous logs
- Refer to the <platform_specific_instructions> for more information on how to formulate your query

Information Gathering Process:
- First identify the occurrence of the issue/event being described and find an identifier (e.g. username or id) to trace the sequence of events. Do not move on until you have found the area where the issue/event occurred.
- Then identifiers that are likely to trace a sequence of events in your keyword searches (e.g. usernames or ids) to filter out noise and get a broader picture of sequence of events. If you do not filter on these identifiers, there will be too many logs and it will be difficult to tell which events lead to others.
- Try to obtain a broad view of logs that captures the issue/event, context surrounding it, and from multiple services to get a full picture.
- Once you have outlined a coherent/comprehensive sequence of events in your reasoning, you can output a \`TaskComplete\` to indicate that you have completed the request.

Tips:
- Prefer relatively simple queries at the beginning while you're gathering initial understanding.
- DO NOT query system or database logs for now (this includes logs from database pods, NATS message queues/servers, etc.).
- The timezone for start and end dates should be Universal Coordinated Time (UTC).
- If log search is not returning results (as may show in message history), adjust/widen query as needed.
- Do not output \`TaskComplete\` until you have a broad view of logs captured at least once across multiple services to get full view.
- Be generous on the time ranges and give +/- 15 minutes to ensure you capture the issue/event (e.g. 4:10am to 4:40am if issue/event was at 4:25am).
- If there is source code in your previously gathered context, use it to inform your log search.

Rules:
- Output just 1 single \`LogSearchInput\` at a time. DO NOT output multiple \`LogSearchInput\`s.
- Look at the context previously gathered to see what logs you have already fetched and what queries you've tried, DO NOT repeat past queries
- Returned logs will be displayed in this format for each log line: <service> <timestamp> <content>

<current_time>
${currentTime}
</current_time>

<log_labels>
${params.labelsMap}
</log_labels>

<platform_specific_instructions>
${params.platformSpecificInstructions}
</platform_specific_instructions>

Use the below history of context you already gathered to inform what steps you will take next. DO NOT make the same query twice, it is a waste of the context window.

<query>
${params.query}
</query>

<log_request>
${params.logRequest}
</log_request>

<context_previously_gathered>
${formatChatHistory(params.chatHistory)}
</context_previously_gathered>
`;
}

function createLogSearchSummaryPrompt(params: {
  query: string;
  logResults: Map<LogSearchInput, string>;
}): string {
  const currentTime = new Date().toISOString();

  return `
Given a set log queries and the fetched log results, concisely summarize the main findings as they pertain to the provided user query and how we may debug the issue/event. Your response just be a short sequence of events you've observed through the logs that are relevant to the user query. The response should NOT be speculative about any root causes or further issues—it should objectively summarize what the logs show.

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
    labelsMap: string;
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
        query: "status:error",
        limit: 100,
        reasoning: "Failed to generate query with LLM. Using fallback query.",
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
    labelsMap: string;
    chatHistory: string[];
    maxIters?: number;
  }): Promise<LogSearchAgentResponse> {
    let chatHistory: string[] = params.chatHistory;
    let logResults: Map<LogSearchInput, string> = new Map();
    let response: LogSearchResponse | null = null;
    const maxIters = params.maxIters || 10;
    let currentIter = 0;

    while ((!response || response.type !== "taskComplete") && currentIter < maxIters) {
      response = await this.logSearch.invoke({
        query: params.query,
        logRequest: params.logRequest,
        chatHistory: chatHistory,
        labelsMap: params.labelsMap,
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

          logger.info(`Log search results:\n${logContext}`);
          logger.info(`Log search reasoning:\n${response.reasoning}`);

          logResults.set(response, logContext);

          chatHistory = [
            ...chatHistory,
            `Query: ${response.query}.\nStart: ${response.start}.\nEnd: ${response.end}.\nLimit: ${response.limit}.\nLog search results:\n${logContext}\nReasoning:\n${response.reasoning}`,
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

    const { text } = await generateText({
      model: getModelWrapper(this.reasoningModel),
      prompt: summaryPrompt,
    });

    logger.info(`Log search summary:\n${text}`);

    return {
      newLogContext: logResults,
      summary: text,
    };
  }
}
