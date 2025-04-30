import { formatCodeMap, getModelWrapper, logger, Model, timer } from "@triage/common";
import { LogsWithPagination } from "@triage/observability";
import { streamText } from "ai";

import {
  logRequestToolSchema,
  LogSearchInputCore,
  RequestToolCalls,
  RootCauseAnalysis,
} from "../types";

import { v4 as uuidv4 } from "uuid";
import { AgentStreamUpdate } from "..";
import { formatFacetValues, formatLogResults } from "./utils";
export type ReviewerResponse = RequestToolCalls | RootCauseAnalysis;

export interface ReviewerParams {
  query: string;
  codebaseOverview: string;
  fileTree: string;
  logLabelsMap: Map<string, string[]>;
  spanLabelsMap: Map<string, string[]>;
  chatHistory: string[];
  codeContext: Map<string, string>;
  logContext: Map<string, string>;
}

function createPrompt(params: {
  query: string;
  repoPath: string;
  codebaseOverview: string;
  logLabelsMap: Map<string, string[]>;
  spanLabelsMap: Map<string, string[]>;
  chatHistory: string[];
  codeContext: Map<string, string>;
  logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
  rootCauseAnalysis: string;
}): string {
  // Format facet maps
  const formattedLogLabels = formatFacetValues(params.logLabelsMap);
  const formattedSpanLabels = formatFacetValues(params.spanLabelsMap);

  return `
Given the user query about the potential issue/event, and the initial 'root cause analysis', your job is to review the analysis for completeness and accuracy.

Analyze the root cause analysis for:
1. Completeness - are there gaps in the explanation? 
2. Accuracy - does this explanation align with the logs/code context? 
3. Actionability - is the proposed fix clear and a true forward fix?

If you believe additional information is needed to provide a complete root cause analysis, use the following tools:
- logRequest - Get logs, using a query with service names and filters 
- spanRequest - Get spans/traces, using a query with service names

If you believe the root cause analysis is correct and complete, do not call any tools and just return the original analysis.

<query>
${params.query}
</query>

<log_labels>
${formattedLogLabels}
</log_labels>

<span_labels>
${formattedSpanLabels}
</span_labels>

<code_context>
${formatCodeMap(params.codeContext)}
</code_context>

<log_context>
${formatLogResults(params.logContext)}
</log_context>

<root_cause_analysis>
${params.rootCauseAnalysis}
</root_cause_analysis>
`;
}

export class Reviewer {
  private llm: Model;

  constructor(llm: Model) {
    this.llm = llm;
  }

  @timer
  async invoke(params: {
    query: string;
    repoPath: string;
    codebaseOverview: string;
    logLabelsMap: Map<string, string[]>;
    spanLabelsMap: Map<string, string[]>;
    chatHistory: string[];
    codeContext: Map<string, string>;
    logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
    rootCauseAnalysis: string;
    parentId: string;
    onUpdate?: (update: AgentStreamUpdate) => void;
  }): Promise<ReviewerResponse> {
    logger.info(`Reviewing root cause analysis for query: ${params.query}`);

    const prompt = createPrompt(params);
    logger.info(`Reviewer prompt: ${prompt}`);

    const { fullStream } = streamText({
      model: getModelWrapper(this.llm),
      prompt: prompt,
      tools: {
        // TODO: add other tools
        logRequest: logRequestToolSchema,
      },
      toolChoice: "auto",
      toolCallStreaming: true,
    });

    let text = "";
    const requestToolCalls: RequestToolCalls = {
      type: "toolCalls",
      toolCalls: [],
    };

    for await (const part of fullStream) {
      if (part.type === "text-delta") {
        text += part.textDelta;

        if (params.onUpdate) {
          // Always send the text delta with a parent ID for proper rendering
          params.onUpdate({
            type: "intermediateUpdate",
            stepType: "review",
            id: uuidv4(),
            parentId: params.parentId,
            content: part.textDelta,
          });
        }
      } else if (part.type === "tool-call") {
        if (part.toolName === "logRequest") {
          requestToolCalls.toolCalls.push({
            type: "logRequest",
            request: part.args.request,
            reasoning: part.args.reasoning,
          });
        }
        // TODO: add cases for other future tools
      }
    }

    logger.info(`Reviewer response:\n${text}`);
    logger.info(`Reviewer tool calls:\n${JSON.stringify(requestToolCalls.toolCalls, null, 2)}`);

    // Create the appropriate output object based on the type
    let output: ReviewerResponse;
    if (requestToolCalls.toolCalls.length === 0) {
      // If no tool calls, return the actual streamed text from the model
      // instead of just re-using the original rootCauseAnalysis input
      output = {
        type: "rootCauseAnalysis",
        rootCause: text.trim() || params.rootCauseAnalysis,
      };
    } else {
      // For tool calls, construct the RequestToolCalls object
      output = {
        type: "toolCalls",
        toolCalls: [],
      };

      for (const toolCall of requestToolCalls.toolCalls) {
        if (toolCall.type === "logRequest") {
          output.toolCalls.push({
            type: "logRequest",
            request: toolCall.request,
            reasoning: toolCall.reasoning,
          });
        }
        // TODO: add cases for other future tools
      }
    }

    return output;
  }
}
