import { AgentStep } from "@triage/agent";
import {
  AgentAssistantMessage,
  AgentStage,
  AgentUserMessage,
  AssistantMessage,
  ChatMessage,
  UserMessage,
} from "../types/index.js";

export type StageOf<T extends AgentStage["type"]> = Extract<AgentStage, { type: T }>;
export function assertStageType<T extends AgentStage["type"]>(
  stage: AgentStage,
  type: T
): asserts stage is StageOf<T> {
  if (stage.type !== type) {
    throw new Error(`Expected stage.type to be ${type}, got ${stage.type}`);
  }
}

/**
 * Converts an array of AgentStage objects back into an array of AgentStep objects
 *
 * @param stages Array of AgentStage objects from the UI
 * @returns Array of AgentStep objects to be used by the agent
 */
export function convertAgentStagesToSteps(stages?: AgentStage[] | null): AgentStep[] {
  if (!Array.isArray(stages) || !stages.length) return [];

  const steps: AgentStep[] = [];

  for (const stage of stages) {
    switch (stage.type) {
      case "logSearch":
        // For logSearch, each query in the stage becomes a separate logSearch step
        stage.steps.forEach((step) => {
          steps.push({
            type: "logSearch",
            timestamp: new Date(),
            reasoning: step.reasoning,
            data: step.data,
          });
        });
        break;
      case "codeSearch":
        // For codeSearch, each retrieved code in the stage becomes a separate codeSearch step
        stage.steps.forEach((step) => {
          steps.push({
            type: "codeSearch",
            timestamp: new Date(),
            reasoning: step.reasoning,
            data: step.data,
          });
        });
        break;
      case "reasoning":
        // For reasoning, create a single reasoning step
        steps.push({
          type: "reasoning",
          timestamp: new Date(),
          data: stage.content,
        });
        break;
      case "logPostprocessing":
        // For logPostprocessing, create a single logPostprocessing step
        steps.push({
          type: "logPostprocessing",
          timestamp: new Date(),
          data: stage.facts,
        });
        break;
      case "codePostprocessing":
        // For codePostprocessing, create a single codePostprocessing step
        steps.push({
          type: "codePostprocessing",
          timestamp: new Date(),
          data: stage.facts,
        });
        break;
      // Handle any other stage types in the future
    }
  }

  return steps;
}

/**
 * Converts a desktop AssistantMessage to an agent AssistantMessage
 *
 * @param message Desktop AssistantMessage
 * @returns Agent AssistantMessage
 */
export function convertToAgentAssistantMessage(message: AssistantMessage): AgentAssistantMessage {
  return {
    role: "assistant",
    steps: convertAgentStagesToSteps(message.stages), // Convert stages back to steps
    response: message.response || null,
    error: message.error || null,
  };
}

/**
 * Converts a desktop UserMessage to an agent UserMessage
 *
 * @param message Desktop UserMessage
 * @returns Agent UserMessage
 */
export function convertToAgentUserMessage(message: UserMessage): AgentUserMessage {
  return {
    role: "user",
    content: message.content,
  };
}

/**
 * Converts an array of desktop ChatMessage objects to an array of agent ChatMessage objects
 *
 * @param messages Array of desktop ChatMessage objects
 * @returns Array of agent ChatMessage objects
 */
export function convertToAgentChatMessages(
  messages: ChatMessage[]
): Array<AgentUserMessage | AgentAssistantMessage> {
  return messages.map((message) => {
    if (message.role === "user") {
      return convertToAgentUserMessage(message);
    } else {
      return convertToAgentAssistantMessage(message);
    }
  });
}
