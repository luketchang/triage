import { getModelWrapper, logger, Model, timer } from "@triage/common";
import { streamText } from "ai";
import { v4 as uuidv4 } from "uuid";

import { AgentStep, AgentStreamUpdate, ChatMessage, ReasoningStep } from "../index";
import { logRequestToolSchema, RequestToolCalls } from "../types/tools";

import { formatAgentSteps, formatChatHistory, formatFacetValues } from "./utils";
type ReasoningResponse = ReasoningStep | RequestToolCalls;

// TODO: some unused params, will fix
export const createPrompt = ({
  query,
  chatHistory,
  repoPath,
  codebaseOverview,
  fileTree,
  logLabelsMap,
  spanLabelsMap,
  agentSteps,
}: {
  query: string;
  chatHistory: ChatMessage[];
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  logLabelsMap: Map<string, string[]>;
  spanLabelsMap: Map<string, string[]>;
  agentSteps: AgentStep[];
}): string => {
  const prompt = `
Given the user query about the potential issue/event, an overview of the codebase, log labels, span labels, and previously gathered log and code context, your task is to come up with a concrete answer to the user query. If the query asks you to diagnose an issue or failure or propose a fix, your response should attempt to provide a precise root cause analysis and a concrete/unambiguous code fix if possible. If you do not have enough information to diagnose the issue OR if your hypotheses are hand-wavy and cannot be concretely supported by walking through the sequence of events of the issue/event, output a \`CodeRequest\` or \`SpanRequest\` to gather more context.

Tips:
- Especially in microservices, the root cause may not be in the service that is failing, but in another service that is interacting with it. Consider other services when reasoning about what you may be missing and write down those hypotheses.
- If you provide a root cause analysis, it should explicitly cite concrete evidence used to reach the conclusion: code blocks with comments, log results with captions, etc.
- If you believe you are missing key context, output a \`CodeRequest\` or \`SpanRequest\` to gather more context.
- Review your own hypotheses and ensure they are concrete and can ve verified by walking through a concrete sequence of events. If they cannot be verified, output a \`CodeRequest\` or \`SpanRequest\` to gather more context.
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

<span_labels>
${formatFacetValues(spanLabelsMap)}
</span_labels>

<chat_history>
${formatChatHistory(chatHistory)}
</chat_history>

<current_gathered_context>
${formatAgentSteps(agentSteps)}
</current_gathered_context>
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
    chatHistory: ChatMessage[];
    repoPath: string;
    codebaseOverview: string;
    fileTree: string;
    logLabelsMap: Map<string, string[]>;
    spanLabelsMap: Map<string, string[]>;
    agentSteps: AgentStep[];
    parentId: string;
    onUpdate?: (update: AgentStreamUpdate) => void;
  }): Promise<ReasoningResponse> {
    logger.info(`Reasoning about query: ${params.query}`);

    const prompt = createPrompt(params);

    logger.info(`Reasoning prompt:\n${prompt}`);

    // Stream reasoning response and collect text and tool calls
    const { fullStream, toolCalls } = streamText({
      model: getModelWrapper(this.llm),
      prompt,
      tools: {
        // TODO: add other tools
        logRequest: logRequestToolSchema,
      },
      toolChoice: "auto",
    });

    let text = "";
    try {
      for await (const part of fullStream) {
        if (part.type === "text-delta") {
          text += part.textDelta;
          // If this is root cause analysis (no tool calls), stream text as it's generated
          if (params.onUpdate) {
            params.onUpdate({
              type: "intermediateUpdate",
              id: uuidv4(),
              parentId: params.parentId,
              step: {
                type: "reasoning",
                timestamp: new Date(),
                contentChunk: part.textDelta,
              },
            });
          }
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
        type: "reasoning",
        timestamp: new Date(),
        content: text,
      };
    } else {
      output = {
        type: "toolCalls",
        toolCalls: [],
      };
      for (const toolCall of finalizedToolCalls) {
        if (toolCall.toolName === "logRequest") {
          output.toolCalls.push({
            type: "logRequest",
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
