import { getModelWrapper, logger, Model, timer } from "@triage/common";
import { streamText } from "ai";
import { v4 as uuidv4 } from "uuid";

import { AgentStep, AgentStreamUpdate, ChatMessage, logRequestToolSchema, RequestToolCalls, ReviewStep } from "../types";

import { formatAgentSteps, formatChatHistory, formatFacetValues } from "./utils";

export type ReviewerResponse = ReviewStep | RequestToolCalls;

function createPrompt(params: {
  query: string;
  chatHistory: ChatMessage[];
  repoPath: string;
  codebaseOverview: string;
  logLabelsMap: Map<string, string[]>;
  spanLabelsMap: Map<string, string[]>;
  agentSteps: AgentStep[];
  answer: string;
}): string {
  // Format facet maps
  const formattedLogLabels = formatFacetValues(params.logLabelsMap);
  const formattedSpanLabels = formatFacetValues(params.spanLabelsMap);

  return `
Given the user query about the potential issue/event, and the initial answer, your job is to review the answer for completeness and accuracy.

Analyze the answer for:
1. Completeness - are there gaps in the explanation? is it hand waving?
2. Accuracy - does this explanation align with the logs/code context? 
3. Actionability - is the proposed fix clear and a true forward fix?

If you believe additional information is needed to provide a complete answer, use the following tools:
- logRequest - Get logs, using a query with service names and filters 
- spanRequest - Get spans/traces, using a query with service names

If you believe the root cause analysis is correct and complete, do not call any tools.

<query>
${params.query}
</query>

<log_labels>
${formattedLogLabels}
</log_labels>

<span_labels>
${formattedSpanLabels}
</span_labels>

<chat_history>
${formatChatHistory(params.chatHistory)}
</chat_history>

<current_gathered_context>
${formatAgentSteps(params.agentSteps)}
</current_gathered_context>

<answer>
${params.answer}
</answer>
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
    chatHistory: ChatMessage[];
    repoPath: string;
    codebaseOverview: string;
    logLabelsMap: Map<string, string[]>;
    spanLabelsMap: Map<string, string[]>;
    agentSteps: AgentStep[];
    answer: string;
    parentId: string;
    onUpdate?: (update: AgentStreamUpdate) => void;
  }): Promise<ReviewerResponse> {
    logger.info(`Reviewing root cause analysis for query: ${params.query}`);

    const prompt = createPrompt(params);
    logger.info(`Reviewer prompt: ${prompt}`);

    const { fullStream, toolCalls } = streamText({
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
    for await (const part of fullStream) {
      if (part.type === "text-delta") {
        text += part.textDelta;

        if (params.onUpdate) {
          // Always send the text delta with a parent ID for proper rendering
          params.onUpdate({
            type: "intermediateUpdate",
            id: uuidv4(),
            parentId: params.parentId,
            step: {
              type: "review",
              timestamp: new Date(),
              contentChunk: part.textDelta,
            },
          });
        }
      }
    }

    const finalizedToolCalls = await toolCalls;

    logger.info(`Reviewer response:\n${text}`);
    logger.info(`Reviewer tool calls:\n${JSON.stringify(finalizedToolCalls, null, 2)}`);

    // Create the appropriate output object based on the type
    let output: ReviewerResponse;
    if (finalizedToolCalls.length === 0) {
      output = {
        type: "review",
        timestamp: new Date(),
        content: text,
      };
    } else {
      // For tool calls, construct the RequestToolCalls object
      output = {
        type: "toolCalls",
        toolCalls: [],
      };

      for (const toolCall of finalizedToolCalls) {
        if (toolCall.toolName === "logRequest") {
          output.toolCalls.push({
            type: toolCall.toolName,
            request: toolCall.args.request,
            reasoning: toolCall.args.reasoning,
          });
        }
        // TODO: add cases for other future tools
      }
    }

    return output;
  }
}
