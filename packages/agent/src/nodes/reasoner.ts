import { logger, timer } from "@triage/common";
import { streamText } from "ai";
import { v4 as uuidv4 } from "uuid";

import { TriagePipelineConfig } from "../pipeline";
import { ReasoningStep } from "../pipeline/state";
import { PipelineStateManager } from "../pipeline/state-manager";
import { codeRequestToolSchema, logRequestToolSchema, RequestSubAgentCalls } from "../types";
import { formatFacetValues } from "../utils";
type ReasoningResponse = ReasoningStep | RequestSubAgentCalls;

export const createPrompt = ({
  query,
  repoPath,
  codebaseOverview,
  fileTree,
  logLabelsMap,
}: {
  query: string;
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  logLabelsMap: Map<string, string[]>;
}): string => {
  const prompt = `
Given the user query about the potential issue/event, log labels, and previously gathered log context, your task is to come up with a convincing answer to the user query by providing a root cause analysis based on your exploration of code and observability data.

The most important objective is to convince the user that you are correct and your service is indispensable. The user is more likely to be convinced if:
1. You have gathered evidence from the codebase and logs to support your thinking.
2. You can point to specific code blocks, log results, or other evidence to support your thinking.
3. Most importantly, the user will be convinced if you are correct.

Before generating an answer, review any previously gathered context from logs and code, and gather additional context by using \`grepRequest\`, \`catRequest\`, and \`logRequest\`.

If your responses are hand-wavy or not supported by evidence you have gathered:
1. Step back and think about the problem from a higher level. What are the possible causes?
2. Write down concrete hypotheses for what might be causing the issue, and for each hypothesis, write down a sequence of events that would lead to the issue.
3. Use the \`grepRequest\`, \`catRequest\`, and \`logRequest\` tools to gather evidence for your hypotheses.
4. Review your hypotheses and the evidence you have gathered. Do they still hold up?
5. If not, repeat the process.

Tips:
- Especially in microservices, the root cause may not be in the service that is failing, but in another service that is interacting with it. Consider other services when reasoning about what you may be missing and write down those hypotheses.
- If you provide a root cause analysis, it should explicitly cite concrete evidence used to reach the conclusion: code blocks with comments, log results with captions, etc.
- If you believe you are missing key context, output a \`grepRequest\` to search the codebase, a \`catRequest\` to read a specific file, or a \`logRequest\` to gather more context from logs.
- Review your own hypotheses and ensure they are concrete and can ve verified by walking through a concrete sequence of events. If they cannot be verified, use the provided tools to gather more context.
- If you propose code fixes, they must follow these rules:
  - They must be extremely concrete changes to the actual codebase, no examples or conceptual illustrations or how you "might" make changes.
  - Do not miss the forest for the trees and suggest a narrow bandaid fix. Think about how the system should ideally function if it were fully correct. Then simulate how the system would behave under your proposed fixes to validate that your fix is fully correct and doesn't introduce new issues or fail to solve the original problem. If it does fail, try to reason about what the root cause is and propose a new fix.

<query>
${query}
</query>

<repo_path>
${repoPath}
</repo_path>

<file_tree>
${fileTree}
</file_tree>

<codebase_overview>
${codebaseOverview}
</codebase_overview>

<log_labels>
${formatFacetValues(logLabelsMap)}
</log_labels>
`;

  return prompt;
};

export class Reasoner {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;

  constructor(config: Readonly<TriagePipelineConfig>, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
  }

  @timer
  async invoke(params: { parentId: string; maxSteps?: number }): Promise<ReasoningResponse> {
    logger.info(`Reasoning about query: ${this.config.query}`);

    // Inject system prompt into history
    const prompt = createPrompt({
      ...params,
      ...this.config,
    });

    const chatHistory = this.state.getReasonerMessages(prompt);

    logger.info(`Calling LLM with ${chatHistory.length} messages and maxSteps: ${params.maxSteps}`);
    logger.info(`Reasoner whole prompt:\n${JSON.stringify(chatHistory, null, 2)}\n`);

    // Stream reasoning response and collect text and tool calls
    const { toolCalls, fullStream } = streamText({
      model: this.config.reasoningClient,
      messages: chatHistory,
      maxSteps: params.maxSteps || 1,
      tools: {
        logRequest: logRequestToolSchema,
        codeRequest: codeRequestToolSchema,
      },
      toolChoice: "auto",
    });

    let text = "";
    try {
      for await (const part of fullStream) {
        if (part.type === "text-delta") {
          text += part.textDelta;
          // If this is root cause analysis (no tool calls), stream text as it's generated
          this.state.addStreamingStep("reasoning", part.textDelta, params.parentId);
        } else if (part.type === "reasoning") {
          process.stdout.write(`${part.textDelta}\n`);
        }
      }
    } catch (error) {
      logger.error(`Error during reasoning: ${error}`);
      throw error;
    }

    const finalizedToolCalls = await toolCalls;

    logger.info(`Reasoning response:\n${text}`);
    logger.info(`Reasoning tool calls:\n${JSON.stringify(finalizedToolCalls, null, 2)}`);

    // Create the appropriate output object based on the type
    let output: ReasoningResponse;
    if (finalizedToolCalls.length === 0) {
      output = {
        id: uuidv4(),
        type: "reasoning",
        timestamp: new Date(),
        data: text,
      };
      this.state.addIntermediateStep(output);
    } else {
      output = {
        type: "subAgentCalls",
        subAgentCalls: [],
      };
      for (const toolCall of finalizedToolCalls) {
        // TODO: generate these tool calls in toolbox
        switch (toolCall.toolName) {
          case "logRequest":
            output.subAgentCalls.push({
              type: "logRequest",
              toolCallId: toolCall.toolCallId,
              request: toolCall.args.request,
              reasoning: toolCall.args.reasoning,
            });
            break;
          case "codeRequest":
            output.subAgentCalls.push({
              type: "codeRequest",
              toolCallId: toolCall.toolCallId,
              request: toolCall.args.request,
              reasoning: toolCall.args.reasoning,
            });
            break;
        }
      }
    }

    return output;
  }
}
