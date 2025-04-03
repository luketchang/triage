import { formatCodeMap, getModelWrapper, logger, Model } from "@triage/common";
import { Log, Span } from "@triage/observability";
import { generateText } from "ai";
import {
  CodeRequest,
  codeRequestToolSchema,
  LogRequest,
  logRequestToolSchema,
  LogSearchInput,
  RootCauseAnalysis,
  rootCauseAnalysisToolSchema,
  SpanRequest,
  spanRequestToolSchema,
  SpanSearchInput,
} from "../types";
import { formatLogResults, formatSpanResults, validateToolCalls } from "./utils";

export type ReasoningResponse = RootCauseAnalysis | CodeRequest | SpanRequest | LogRequest;

function createPrompt(params: {
  query: string;
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  codeContext: Map<string, string>;
  logContext: Map<LogSearchInput, Log[]>;
  spanContext: Map<SpanSearchInput, Span[]>;
  logLabelsMap: string;
  spanLabelsMap: string;
  chatHistory: string[]; // TODO: add back in if needed
}) {
  return `
You are an expert AI assistant that assists engineers debugging production issues. You specifically review context gathered from logs, spans, and code and question whether or not you have enough information. If you do you output a proposed root cause analysis. If not, you output a request for more logs or code. You are not able to make any modifications to the system—you can only reason about the system by looking at the context and walking through sequences of events.

Given the user query about the potential issue/event, an overview of the codebase, the codebase file tree, log labels, span labels, and previously gathered log and code context, your task is to question whether or not you have enough context. 

Go through the below checklist to check if the analysis is too imprecise or has not considered enough thorough context. If any of the below questions reveal that you have not considered enough parts of the codebase or have not retrieved logs thoroughly enough, output a CodeRequest or SpanRequest respectively.

Question Checklist (just to list a few):
- Have you considered all services that could be causing the issue/event or have you only looked at the one demonstrating problems?
- Do you retrieved logs show a wide enough picture of the various services or does your context only show logs from the actual issue/event occurrence for a single service?
- Does your code match any issues/events revealed in the logs?

Guidelines:
- Especially in microservices, the root cause may not be in the service that is failing, but in another service that is interacting with it. Consider other services when reasoning about what you may be missing and write down those hypotheses.
- Reflect on 5-7 different possible sources of the issue/event and use that as a guide to your reasoning process before outputting a \`RootCauseAnalysis\`.
- Only output a \`RootCauseAnalysis\` if you have enough context, have reasoned about a confident answer, and did not previously indicate to yourself that there are other services/hypotheses to explore.
- The root cause analysis, if you choose you are ready, should not cite some vague root cause like "Synchronization Issues" or "Performance Issues" it must be very concrete and have an actionable and exact fix. If not, then that is a sign the analysis is missing information and needs more context.
- Your root cause analysis should explicitly cite the blocks of code and where the are issues, adding inline comments to code to denote where the problem is.

<query>
${params.query}
</query>

<log_labels>
${params.logLabelsMap}
</log_labels>

<span_labels>
${params.spanLabelsMap}
</span_labels>

<previous_log_context>
${formatLogResults(params.logContext)}
</previous_log_context>

<previous_span_context>
${formatSpanResults(params.spanContext)}
</previous_span_context>

<previous_code_context>
${formatCodeMap(params.codeContext)}
</previous_code_context>

<repo_path>
${params.repoPath}
</repo_path>

<codebase_overview>
${params.codebaseOverview}
</codebase_overview>

<file_tree>
${params.fileTree}
</file_tree>

If you feel like you received sufficient context or that some of the code, logs, or spans you retrieved are not relevant to the issue, you should attempt to choose a root cause analysis.
`;
}

export class Reasoner {
  private llm: Model;

  constructor(llm: Model) {
    this.llm = llm;
  }

  async invoke(params: {
    query: string;
    repoPath: string;
    codebaseOverview: string;
    fileTree: string;
    codeContext: Map<string, string>;
    logContext: Map<LogSearchInput, Log[]>;
    spanContext: Map<SpanSearchInput, Span[]>;
    logLabelsMap: string;
    spanLabelsMap: string;
    chatHistory: string[];
  }): Promise<ReasoningResponse> {
    logger.info(`Reasoning about query: ${params.query}`);

    const prompt = createPrompt(params);

    logger.info(`Reasoning prompt:\n${prompt}`);

    const { toolCalls } = await generateText({
      model: getModelWrapper(this.llm),
      prompt: prompt,
      tools: {
        codeRequest: codeRequestToolSchema,
        spanRequest: spanRequestToolSchema,
        logRequest: logRequestToolSchema,
        rootCauseAnalysis: rootCauseAnalysisToolSchema,
      },
      toolChoice: "required",
    });

    const toolCall = validateToolCalls(toolCalls);

    // Create the appropriate output object based on the type
    let outputObj: RootCauseAnalysis | CodeRequest | SpanRequest | LogRequest;
    if (toolCall.toolName === "rootCauseAnalysis") {
      outputObj = {
        type: "rootCauseAnalysis",
        reasoning: toolCall.args.reasoning,
        rootCause: toolCall.args.rootCause,
      };
    } else {
      // For CodeRequest, LogRequest, and SpanRequest, they all have the same structure
      outputObj = {
        type: toolCall.toolName,
        request: toolCall.args.request,
        reasoning: toolCall.args.reasoning,
      };
    }

    return outputObj;
  }
}
