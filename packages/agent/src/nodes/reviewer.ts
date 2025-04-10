import { formatCodeMap, getModelWrapper, logger, Model } from "@triage/common";
import { LogsWithPagination } from "@triage/observability";
import { generateText } from "ai";
import {
  logRequestToolSchema,
  LogSearchInputCore,
  RequestToolCalls,
  RootCauseAnalysis,
  spanRequestToolSchema,
} from "../types";
import { formatChatHistory, formatLogResults } from "./utils";

export type ReviewerResponse = RequestToolCalls | RootCauseAnalysis;

function createPrompt(params: {
  query: string;
  repoPath: string;
  codebaseOverview: string;
  logLabelsMap: string;
  spanLabelsMap: string;
  chatHistory: string[];
  codeContext: Map<string, string>;
  logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
  rootCauseAnalysis: string;
}) {
  return `
You are an expert AI assistant that assists engineers debugging production issues. You specifically review root cause analyses produced by another engineer and reason about its validity and whether or the engineer is missing key context from the codebase, logs or spans. You are not able to make any modifications to the system—you can only reason about the system by looking at the context and walking through sequences of events.

Given the user query about the potential issue/event, an overview of the codebase, the codebase file tree, the files you've previously read, potential log labels, previously gathered log and code context, and a proposed root cause analysis, your task is to question the validity of the analysis.

Go through the checklist below to determine if the analysis is too imprecise or if it has not considered enough thorough context. 

Question Checklist:
- Is the analysis too vague or speculative without providing a real root cause?
- Does the analysis use speculative words like "might" without providing a real root cause?
- Has the engineer focused on a narrow aspect of the problem/codebase without considering the full picture?
- Could the source of the issue/event be in other parts of the logs or code not discussed in the analysis?
- Are there other services/sources of the issue/event that have not been considered (e.g. we've only considered logs from the failing service, but what about logs from other services?)?
- Do the logs retrieved fail to actually reveal a sequence of events that leads to the issue/event?
- Do the logs reveal any additional issues/events or context that might have been overlooked?
- Does the code match the issues/events revealed in the logs?

If the answer to any of the above questions is "yes", output a \`LogRequest\` or \`SpanRequest\` for additional information. If you believe the root cause analysis is correct and complete, provide no tool calls and instead critique the analysis directly.

Guidelines:
- Exact Sequence Requirement: Ensure that the root cause analysis includes an explicit, exact sequence of events that directly correlates with the provided context, logs, or code.
- Consider if the proposed analysis only examines a small part of the system. If you suspect the root cause lies upstream or downstream, specify which other services should be investigated.
- When reviewing logs, verify that you have a comprehensive view rather than just logs from the error occurrence. The logs should encompass the activities of other services leading up to the issue/event.
- Recognize that in microservices architectures, the failing service might not be the source of the issue/event; it could be caused by another interacting service. Outline any additional hypotheses regarding missing context.
- The analysis must not rely on vague root causes like "Synchronization Issues" or "Performance Issues." It must be concrete, actionable, and provide an exact fix. Otherwise, it is a sign that further context is needed.
- Refer to the content in the <files_read> to verify implementation details of the codebase.

- DO NOT use XML tags
- A request for more logs should output a \`LogRequest\` for additional logs, and a request for more spans should output a \`SpanRequest\` for additional spans.
- You may output multiple tool calls if needed.

<current_time>
${new Date().toUTCString()}
</current_time>

<codebase_path>
${params.repoPath}
</codebase_path>

<codebase_overview>
${params.codebaseOverview}
</codebase_overview>

<log_labels>
${params.logLabelsMap}
</log_labels>

<span_labels>
${params.spanLabelsMap}
</span_labels>

<chat_history>
${formatChatHistory(params.chatHistory)}
</chat_history>

<query>
${params.query}
</query>

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

  async invoke(params: {
    query: string;
    repoPath: string;
    codebaseOverview: string;
    logLabelsMap: string;
    spanLabelsMap: string;
    chatHistory: string[];
    codeContext: Map<string, string>;
    logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
    rootCauseAnalysis: string;
  }): Promise<ReviewerResponse> {
    logger.info(`Reviewing root cause analysis for query: ${params.query}`);

    const prompt = createPrompt(params);
    logger.info(`Reviewer prompt: ${prompt}`);

    const { toolCalls, text } = await generateText({
      model: getModelWrapper(this.llm),
      prompt: prompt,
      tools: {
        spanRequest: spanRequestToolSchema,
        logRequest: logRequestToolSchema,
      },
      toolChoice: "auto",
    });

    logger.info(`Reviewer response:\n${text}`);
    logger.info(`Reviewer tool calls:\n${JSON.stringify(toolCalls, null, 2)}`);

    // Create the appropriate output object based on the type
    let output: ReviewerResponse;
    if (toolCalls.length === 0) {
      // If no tool calls, return the root cause analysis as-is
      output = {
        type: "rootCauseAnalysis",
        rootCause: params.rootCauseAnalysis,
      };
    } else {
      // For tool calls, construct the RequestToolCalls object
      output = {
        type: "toolCalls",
        toolCalls: [],
      };

      for (const toolCall of toolCalls) {
        const toolName = toolCall.toolName as string;
        if (toolName === "logRequest") {
          output.toolCalls.push({
            type: "logRequest",
            request: toolCall.args.request,
            reasoning: toolCall.args.reasoning,
          });
        } else if (toolName === "spanRequest") {
          output.toolCalls.push({
            type: "spanRequest",
            request: toolCall.args.request,
            reasoning: toolCall.args.reasoning,
          });
        } else {
          throw new Error(`Unexpected tool name: ${toolName}`);
        }
      }
    }

    return output;
  }
}
