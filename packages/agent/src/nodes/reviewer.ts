import {
  AnthropicModel,
  formatCodeMap,
  getModelWrapper,
  logger,
  OpenAIModel,
} from "@triage/common";
import { generateText } from "ai";
import {
  CodeRequest,
  codeRequestToolSchema,
  LogRequest,
  logRequestToolSchema,
  SpanRequest,
  spanRequestToolSchema,
  TaskComplete,
  taskCompleteToolSchema,
} from "../types";
import { formatChatHistory, formatLogResults, validateToolCalls } from "./utils";

export type ReviewerResponse = TaskComplete | CodeRequest | SpanRequest | LogRequest;

function createPrompt(params: {
  issue: string;
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  labelsMap: string;
  chatHistory: string[];
  codeContext: Record<string, string>;
  logContext: Record<string, string>;
  rootCauseAnalysis: string;
}) {
  // TODO: add back SpanRequest
  return `
You are an expert AI assistant that assists engineers debugging production issues. You specifically review root cause analyses produced by another engineer and reason about its validity and whether or the engineer is missing key context from the codebase, logs or spans. You are not able to make any modifications to the system—you can only reason about the system by looking at the context and walking through sequences of events.

Given the issue encountered, an overview of the codebase, the codebase file tree, the files you've previously read, potential log labels, previously gathered log and code context, and a proposed root cause analysis, your task is to question the validity of the analysis.

Go through the checklist below to determine if the analysis is too imprecise or if it has not considered enough thorough context. 

Question Checklist:
- Is the analysis too vague or speculative without providing a real root cause?
- Does the analysis use speculative words like "might" without providing a real root cause?
- Has the engineer focused on a narrow aspect of the problem/codebase without considering the full picture?
- Could the source of the issue be in other parts of the logs or code not discussed in the analysis?
- Are there other services/sources of the issue that have not been considered (e.g. we've only considered logs from the failing service, but what about logs from other services?)?
- Do the logs retrieved fail to actually reveal a sequence of events that leads to the issue?
- Do the logs reveal any additional issues or context that might have been overlooked?
- Does the code match the issues revealed in the logs?

If the answer to any of the above questions is "yes", output either a \`LogRequest\` for additional logs or a \`CodeRequest\` for additional code. Note, you must pick one tool to output. 

Guidelines:
- Exact Sequence Requirement: Ensure that the root cause analysis includes an explicit, exact sequence of events that directly correlates with the provided context, logs, or code. If the analysis does not clearly describe such a sequence, do not output TaskComplete; instead, output a \`CodeRequest\` or \`LogRequest\` to guide next explorations.
- Consider if the proposed analysis only examines a small part of the system. If you suspect the root cause lies upstream or downstream, specify which other services should be investigated.
- When reviewing logs, verify that you have a comprehensive view rather than just logs from the error occurrence. The logs should encompass the activities of other services leading up to the issue.
- Recognize that in microservices architectures, the failing service might not be the source of the issue; it could be caused by another interacting service. Outline any additional hypotheses regarding missing context.
- If further code context is required, output a \`CodeRequest\` detailing what types of code should be examined. Similarly, if more logs are needed, output a \`LogRequest\` specifying the required log types.
- Task Completion Condition: Only output TaskComplete if you are convinced that the engineer's root cause analysis is correct, precise, and is not speculative but actually complete.
- The analysis must not rely on vague root causes like "Synchronization Issues" or "Performance Issues." It must be concrete, actionable, and provide an exact fix. Otherwise, it is a sign that further context is needed.
- Refer to the content in the <files_read> to verify implementation details of the codebase.

- DO NOT use XML tags
- A request for more logs MUST output a \`LogRequest\`, and a request for more code MUST output a \`CodeRequest\`.
- DO NOT output a \`CodeRequest\` if you have already read the file (e.g. if the file is in the <files_read> tag).
- You may only output one tool call at a time.

<current_time>
${new Date().toUTCString()}
</current_time>

<codebase_path>
${params.repoPath}
</codebase_path>

<codebase_overview>
${params.codebaseOverview}
</codebase_overview>

<file_tree>
${params.fileTree}
</file_tree>

<log_labels>
${params.labelsMap}
</log_labels>

<chat_history>
${formatChatHistory(params.chatHistory)}
</chat_history>

<issue>
${params.issue}
</issue>

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
  private llm: OpenAIModel | AnthropicModel;

  constructor(llm: OpenAIModel | AnthropicModel) {
    this.llm = llm;
  }

  async invoke(params: {
    issue: string;
    repoPath: string;
    codebaseOverview: string;
    fileTree: string;
    labelsMap: string;
    chatHistory: string[];
    codeContext: Record<string, string>;
    logContext: Record<string, string>;
    rootCauseAnalysis: string;
  }): Promise<ReviewerResponse> {
    logger.info(`Reviewing root cause analysis for issue: ${params.issue}`);

    const prompt = createPrompt(params);
    logger.info(`Reviewer prompt: ${prompt}`);

    const { toolCalls } = await generateText({
      model: getModelWrapper(this.llm),
      prompt: prompt,
      tools: {
        codeRequest: codeRequestToolSchema,
        spanRequest: spanRequestToolSchema,
        logRequest: logRequestToolSchema,
        taskComplete: taskCompleteToolSchema,
      },
      toolChoice: "required",
    });

    const toolCall = validateToolCalls(toolCalls);

    // Create the appropriate output object based on the type
    let outputObj: TaskComplete | CodeRequest | SpanRequest | LogRequest;
    if (toolCall.toolName === "taskComplete") {
      outputObj = {
        type: "taskComplete",
        reasoning: toolCall.args.reasoning,
        summary: toolCall.args.summary,
      };
    } else if (
      toolCall.toolName === "codeRequest" ||
      toolCall.toolName === "spanRequest" ||
      toolCall.toolName === "logRequest"
    ) {
      // For CodeRequest, SpanRequest, and LogRequest, they all have the same structure
      outputObj = {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        type: toolCall.toolName as "codeRequest" | "spanRequest" | "logRequest",
        request: toolCall.args.request,
        reasoning: toolCall.args.reasoning,
      };
    } else {
      // At this point TypeScript narrows toolCall.toolName to 'never' type
      // since it should have been caught by the previous conditions
      throw new Error("Unexpected tool name received");
    }

    return outputObj;
  }
}
