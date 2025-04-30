import { formatCodeMap, getModelWrapper, logger, Model, timer } from "@triage/common";
import { LogsWithPagination, SpansWithPagination } from "@triage/observability";
import { streamText } from "ai";
import { v4 as uuidv4 } from "uuid";

import { AgentStreamUpdate } from "../index";
import {
  logRequestToolSchema,
  LogSearchInputCore,
  RequestToolCalls,
  RootCauseAnalysis,
  SpanSearchInputCore,
} from "../types";

import { formatFacetValues, formatLogResults, formatSpanResults } from "./utils";
type ReasoningResponse = RootCauseAnalysis | RequestToolCalls;

export interface ReasoningParams {
  query: string;
  codebaseOverview: string;
  fileTree: string;
  logLabelsMap: Map<string, string[]>;
  spanLabelsMap: Map<string, string[]>;
  chatHistory: string[];
  codeContext: Map<string, string>;
  logContext: Map<string, string>;
  spanContext: Map<string, string>;
}

export interface ReasoningOutput {
  chatResponse: string;
  rootCauseAnalysis: string;
  logLabelsMap: Map<string, string[]>;
  spanLabelsMap: Map<string, string[]>;
  chatHistory: string[];
  codeContext: Map<string, string>;
  logContext: Map<string, string | LogsWithPagination>;
  spanContext: Map<string, string | SpansWithPagination>;
}

// TODO: some unused params, will fix
export const createPrompt = ({
  query,
  repoPath: _repoPath,
  codebaseOverview,
  fileTree: _fileTree,
  codeContext,
  logContext,
  spanContext,
  logLabelsMap,
  spanLabelsMap,
  chatHistory: _chatHistory,
}: {
  query: string;
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  codeContext: Map<string, string>;
  logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
  spanContext: Map<SpanSearchInputCore, SpansWithPagination | string>;
  logLabelsMap: Map<string, string[]>;
  spanLabelsMap: Map<string, string[]>;
  chatHistory: string[];
}): string => {
  const formattedLogLabels = formatFacetValues(logLabelsMap);
  const formattedSpanLabels = formatFacetValues(spanLabelsMap);

  const prompt = `
Given the user query about the potential issue/event, an overview of the codebase, log labels, span labels, and previously gathered log and code context, your task is to come up with a concrete answer to the user query. If the query asks you to diagnose a live issue/failure, your response should attempt to provide a root cause analysis and a concrete/unambiguous code fix if possible. If you do not have enough information to diagnose the issue OR if your hypotheses are hand-wavy and cannot be concretely supported by walking through the sequence of events of the issue/event, output a \`CodeRequest\` or \`SpanRequest\` to gather more context.

Tips:
- Especially in microservices, the root cause may not be in the service that is failing, but in another service that is interacting with it. Consider other services when reasoning about what you may be missing and write down those hypotheses.
- If you provide a root cause analysis, it should explicitly cite concrete evidence used to reach the conclusion: code blocks with comments, log results with captions, etc.
- If you believe you are missing key context, output a \`CodeRequest\` or \`SpanRequest\` to gather more context.
- Review your own hypotheses and ensure they are concrete and can ve verified by walking through a concrete sequence of events. If they cannot be verified, output a \`CodeRequest\` or \`SpanRequest\` to gather more context.
- If you propose code fixes, they must follow these rules:
  - They must be extremely concrete changes to the actual codebase, no examples or conceptual illustrations or how you "might" make changes.
  - Do not miss the forest for the trees and suggest a narrow bandaid fix. Think about how the system should ideally function if it were fully correct. Then rerun the sequence of events from the issue/event in your head given your proposed fix and ensure the end-to-end behavior is correct.

<query>
${query}
</query>

<codebase_overview>
${codebaseOverview}
</codebase_overview>

<log_labels>
${formattedLogLabels}
</log_labels>

<span_labels>
${formattedSpanLabels}
</span_labels>

<code_context>
${formatCodeMap(codeContext)}
</code_context>

<log_context>
${formatLogResults(logContext)}
</log_context>

<span_context>
${formatSpanResults(spanContext)}
</span_context>
`;

  return prompt;
};

export class Reasoner {
  private llm: Model;

  constructor(llm: Model) {
    this.llm = llm;
  }

  @timer
  async invoke(params: {
    query: string;
    repoPath: string;
    codebaseOverview: string;
    fileTree: string;
    codeContext: Map<string, string>;
    logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
    spanContext: Map<SpanSearchInputCore, SpansWithPagination | string>;
    logLabelsMap: Map<string, string[]>;
    spanLabelsMap: Map<string, string[]>;
    chatHistory: string[];
    parentId: string;
    onUpdate?: (update: AgentStreamUpdate) => void;
  }): Promise<ReasoningResponse> {
    logger.info(`Reasoning about query: ${params.query}`);

    const prompt = createPrompt(params);

    logger.info(`Reasoning prompt:\n${prompt}`);

    // Stream reasoning response and collect text and tool calls
    const { fullStream } = streamText({
      model: getModelWrapper(this.llm),
      prompt,
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
        // If this is root cause analysis (no tool calls), stream text as it's generated
        if (params.onUpdate) {
          params.onUpdate({
            type: "intermediateUpdate",
            stepType: "reasoning",
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

    logger.info(`Reasoning response:\n${text}`);
    logger.info(`Reasoning tool calls:\n${JSON.stringify(requestToolCalls, null, 2)}`);

    // Create the appropriate output object based on the type
    let output: ReasoningResponse;
    if (requestToolCalls.toolCalls.length === 0) {
      output = {
        type: "rootCauseAnalysis",
        rootCause: text,
      };
    } else {
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
