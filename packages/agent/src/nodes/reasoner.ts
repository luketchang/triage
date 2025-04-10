import { formatCodeMap, getModelWrapper, logger, Model } from "@triage/common";
import { LogsWithPagination, SpansWithPagination } from "@triage/observability";
import { generateText } from "ai";
import {
  logRequestToolSchema,
  LogSearchInputCore,
  RequestToolCalls,
  RootCauseAnalysis,
  SpanSearchInputCore,
} from "../types";
import { formatLogResults, formatSpanResults } from "./utils";

type ReasoningResponse = RootCauseAnalysis | RequestToolCalls;

function createPrompt(params: {
  query: string;
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  codeContext: Map<string, string>;
  logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
  spanContext: Map<SpanSearchInputCore, SpansWithPagination | string>;
  logLabelsMap: string;
  spanLabelsMap: string;
  chatHistory: string[]; // TODO: add back in if needed
}) {
  return `
Given the user query about the potential issue/event, an overview of the codebase, the codebase file tree, log labels, span labels, and previously gathered log and code context, your task is to come up with a hypothesis about the root cause of the issue/event and propose an concrete and unambiguous code fix if possible. Your response should clearly explain the answer and propose a fix if needed.


Tips:
- Especially in microservices, the root cause may not be in the service that is failing, but in another service that is interacting with it. Consider other services when reasoning about what you may be missing and write down those hypotheses.
- Reflect on 5-7 different possible sources of the issue/event and use that as a guide to your reasoning process before outputting a \`RootCauseAnalysis\`.
- Your root cause analysis should explicitly cite the blocks of code and where the are issues, adding inline comments to code to denote where the problem is.
- If you believe you are missing key context, output a \`CodeRequest\` or \`SpanRequest\` to gather more context.
- If you propose code fixes, they must follow the these rules/steps:
  - They must be extremely concrete changes to the actual codebase, no examples or conceptual illustrations or how you "might" make changes.
  - They must not introduce any new bugs or unintended behavior. They must lead to the correct overall behavior and not just be a fix in the narrow context of the issue/event. Think about this as you come up with the fixes.
  - Rerun the issue/event in your head given your proposed fix and ensure the end behavior is correct.
  - Should take into account overall best practices for using various libraries, tooling, etc and not miss the forest for the trees. Zoom out and make sure you're fix is not just a hotfix for a narrow issue but fully address the broader problem.

<query>
${params.query}
</query>

<codebase_overview>
${params.codebaseOverview}
</codebase_overview>

<log_labels>
${params.logLabelsMap}
</log_labels>

<span_labels>
${params.spanLabelsMap}
</span_labels>

<code_context>
${formatCodeMap(params.codeContext)}
</code_context>

<log_context>
${formatLogResults(params.logContext)}
</log_context>

<span_context>
${formatSpanResults(params.spanContext)}
</span_context>
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
    logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
    spanContext: Map<SpanSearchInputCore, SpansWithPagination | string>;
    logLabelsMap: string;
    spanLabelsMap: string;
    chatHistory: string[];
  }): Promise<ReasoningResponse> {
    logger.info(`Reasoning about query: ${params.query}`);

    const prompt = createPrompt(params);

    logger.info(`Reasoning prompt:\n${prompt}`);

    const { toolCalls, text } = await generateText({
      model: getModelWrapper(this.llm),
      prompt: prompt,
      tools: {
        // spanRequest: spanRequestToolSchema,
        logRequest: logRequestToolSchema,
      },
      toolChoice: "auto",
    });

    logger.info(`Reasoning response:\n${text}`);
    logger.info(`Reasoning tool calls:\n${JSON.stringify(toolCalls, null, 2)}`);

    // Create the appropriate output object based on the type
    let output: ReasoningResponse;
    if (toolCalls.length === 0) {
      output = {
        type: "rootCauseAnalysis",
        rootCause: text,
      };
    } else {
      output = {
        type: "toolCalls",
        toolCalls: [],
      };
      for (const toolCall of toolCalls) {
        if (toolCall.toolName === "logRequest") {
          output.toolCalls.push({
            type: "logRequest",
            request: toolCall.args.request,
            reasoning: toolCall.args.reasoning,
          });
        } else if (toolCall.toolName === "spanRequest") {
          output.toolCalls.push({
            type: "spanRequest",
            request: toolCall.args.request,
            reasoning: toolCall.args.reasoning,
          });
        } else {
          throw new Error(`Unexpected tool name: ${toolCall.toolName}`);
        }
      }
    }

    return output;
  }
}
