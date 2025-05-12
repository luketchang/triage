import { logger, timer } from "@triage/common";
import { CoreMessage, streamText } from "ai";

import { TriagePipelineConfig } from "../pipeline";
import { PipelineStateManager, ReviewStep } from "../pipeline/state";
import { reviewDecisionToolSchema } from "../types";

import { formatFacetValues } from "./utils";

function formatLlmChatHistory(llmChatHistory: Readonly<CoreMessage[]>): string {
  return llmChatHistory
    .map((message) => {
      switch (message.role) {
        case "user":
          return `User: ${message.content}`;
        case "assistant":
          if (message.content instanceof Array) {
            const content = message.content
              .map((part) => {
                switch (part.type) {
                  // TODO: confirm these don't co-occur
                  case "text":
                    return part.text;
                  case "tool-call":
                    return `tool call(id: ${part.toolCallId}, name: ${part.toolName}, args: ${JSON.stringify(part.args)})`;
                }
              })
              .join("");
            return `Assistant: ${content}`;
          }
          return `Assistant: ${message.content}`;
        case "tool":
          return message.content
            .map((result) => {
              return `Tool result (id: ${result.toolCallId}): ${result.result}`;
            })
            .join("\n");
        case "system":
          return `System: ${message.content}`;
      }
    })
    .join("\n");
}

function createPrompt(params: {
  query: string;
  logLabelsMap: Map<string, string[]>;
  llmChatHistory: Readonly<CoreMessage[]>;
  answer: string;
}): string {
  // Format facet maps
  const formattedLogLabels = formatFacetValues(params.logLabelsMap);

  return `
Given the user query about the potential issue/event, and the initial answer, your job is to review the answer for completeness and accuracy.

Analyze the answer for:
1. Completeness - are there gaps in the explanation? is it hand waving?
2. Accuracy - does this explanation align with the logs/code context? 
3. Actionability - is the proposed fix clear and a true forward fix?

Once you have reviewed the answer, use the provided tool to provide a decision on whether the answer is complete and accurate.

If you believe the root cause analysis is correct and complete, you can give a short explanation.

If you believe the root cause analysis is incomplete or inaccurate, give a detailed explanation of what is missing or incorrect, as well as pointers for how to proceed and specific acceptance criteria for a future review.

<query>
${params.query}
</query>

<log_labels>
${formattedLogLabels}
</log_labels>

<llm_chat_history>
${formatLlmChatHistory(params.llmChatHistory)}
</llm_chat_history>

<answer>
${params.answer}
</answer>
`;
}

export class Reviewer {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;

  constructor(config: Readonly<TriagePipelineConfig>, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
  }

  @timer
  async invoke(params: { parentId: string }): Promise<ReviewStep> {
    logger.info(`Reviewing root cause analysis for query: ${this.config.query}`);

    const prompt = createPrompt({
      query: this.config.query,
      logLabelsMap: this.config.logLabelsMap,
      llmChatHistory: this.state.getReasonerChatHistory(),
      answer: this.state.getAnswer()!,
    });

    const { fullStream, toolCalls } = streamText({
      model: this.config.fastClient,
      prompt: prompt,
      tools: {
        reviewDecision: reviewDecisionToolSchema,
      },
      toolChoice: {
        // Force the model to use the tool to output a decision
        type: "tool",
        toolName: "reviewDecision",
      },
      toolCallStreaming: true,
    });

    let text = "";
    for await (const part of fullStream) {
      if (part.type === "text-delta") {
        text += part.textDelta;
        this.state.addStreamingStep("review", part.textDelta, params.parentId);
      } else if (part.type === "tool-call-delta") {
        this.state.addStreamingStep("review", part.argsTextDelta, params.parentId);
      }
    }

    const finalizedToolCalls = await toolCalls;

    if (finalizedToolCalls.length != 1) {
      logger.error(`Error in reviewer:\n${JSON.stringify(finalizedToolCalls, null, 2)}\n\n${text}`);
      throw new Error("Error in reviewer tool calls");
    }

    logger.info(`Reviewer response:\n${text}`);
    logger.info(`Reviewer tool calls:\n${JSON.stringify(finalizedToolCalls, null, 2)}`);

    const toolCall = finalizedToolCalls[0]!;
    return {
      type: "review",
      timestamp: new Date(),
      content: toolCall.args.reasoning,
      accepted: toolCall.args.accepted,
    };
  }
}
