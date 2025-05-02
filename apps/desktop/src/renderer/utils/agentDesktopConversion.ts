import {
  ChatMessage as AgentChatMessage,
  AgentStep,
  AgentStepType,
  LogSearchStep,
} from "@triage/agent";
import {
  AgentAssistantMessage,
  AgentStage,
  AgentUserMessage,
  AssistantMessage,
  ChatMessage,
  UserMessage,
} from "../types";
import { generateId } from "./formatters";

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
 * Converts an array of AgentStep objects into an array of AgentStage objects
 * A stage is a higher level step that may include multiple agent steps of the same type
 * For example, a LogSearchStage contains multiple LogSearchStep objects
 *
 * @param steps Array of AgentStep objects from the agent
 * @returns Array of AgentStage objects to be used in the UI
 */
export function convertAgentStepsToStages(steps: AgentStep[]): AgentStage[] {
  if (!steps.length) return [];

  const stages: AgentStage[] = [];
  let currentStageType: AgentStepType | null = null;
  let currentStage: AgentStage | null = null;

  for (const step of steps) {
    // If this is a new stage type or the first step
    if (step.type !== currentStageType) {
      // If we were building a stage, finalize it and add to stages array
      if (currentStage) {
        stages.push(currentStage);
      }

      // Start a new stage based on the step type
      currentStageType = step.type;

      switch (step.type) {
        case "logSearch":
          currentStage = {
            type: "logSearch",
            id: generateId(),
            queries: [],
          };
          break;
        case "reasoning":
          currentStage = {
            type: "reasoning",
            id: generateId(),
            content: step.content,
          };
          break;
        case "review":
          currentStage = {
            type: "review",
            id: generateId(),
            content: step.content,
          };
          break;
        case "logPostprocessing":
          currentStage = {
            type: "logPostprocessing",
            id: generateId(),
            facts: step.facts,
          };
          break;
        case "codePostprocessing":
          currentStage = {
            type: "codePostprocessing",
            id: generateId(),
            facts: step.facts,
          };
          break;
        default:
          // Skip unsupported step types
          currentStage = null;
          currentStageType = null;
          continue;
      }
    }

    // Add step data to the current stage
    if (currentStage) {
      switch (step.type) {
        case "logSearch":
          assertStageType(currentStage, "logSearch");
          // For logSearch, we collect multiple steps into the queries array
          currentStage.queries.push({
            input: (step as LogSearchStep).input,
            results: (step as LogSearchStep).results,
          });
          break;
        case "reasoning":
          assertStageType(currentStage, "reasoning");
          // For reasoning, we just use the content directly (already set when creating the stage)
          break;
        case "review":
          assertStageType(currentStage, "review");
          // For review, we just use the content directly (already set when creating the stage)
          break;
        case "logPostprocessing":
          assertStageType(currentStage, "logPostprocessing");
          // For logPostprocessing, we use the facts directly (already set when creating the stage)
          break;
        case "codePostprocessing":
          assertStageType(currentStage, "codePostprocessing");
          // For codePostprocessing, we use the facts directly (already set when creating the stage)
          break;
      }
    }
  }

  // Add the final stage if there is one
  if (currentStage) {
    stages.push(currentStage);
  }

  return stages;
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
    steps: [], // Desktop message doesn't store the original steps, only the processed stages
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
 * Converts an agent AssistantMessage to a desktop AssistantMessage
 *
 * @param message Agent AssistantMessage
 * @returns Desktop AssistantMessage
 */
export function convertToDesktopAssistantMessage(message: AgentAssistantMessage): AssistantMessage {
  return {
    id: generateId(),
    role: "assistant",
    timestamp: new Date(),
    stages: convertAgentStepsToStages(message.steps),
    response: message.response || "",
    error: message.error || undefined,
  };
}

/**
 * Converts an agent UserMessage to a desktop UserMessage
 *
 * @param message Agent UserMessage
 * @returns Desktop UserMessage
 */
export function convertToDesktopUserMessage(message: AgentUserMessage): UserMessage {
  return {
    id: generateId(),
    role: "user",
    timestamp: new Date(),
    content: message.content,
    contextItems: undefined,
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

/**
 * Converts an array of agent ChatMessage objects to an array of desktop ChatMessage objects
 *
 * @param messages Array of agent ChatMessage objects
 * @returns Array of desktop ChatMessage objects
 */
export function convertToDesktopChatMessages(messages: AgentChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (message.role === "user") {
      return convertToDesktopUserMessage(message as AgentUserMessage);
    } else {
      return convertToDesktopAssistantMessage(message as AgentAssistantMessage);
    }
  });
}
