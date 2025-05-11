import { ChatMessage as AgentChatMessage, AgentStep } from "@triage/agent";
import {
  AgentAssistantMessage,
  AgentStage,
  AgentUserMessage,
  AssistantMessage,
  ChatMessage,
  UserMessage,
} from "../types/index.js";
import { generateId } from "./formatters.js";

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
export function convertAgentStepsToStages(steps?: AgentStep[] | null): AgentStage[] {
  if (!Array.isArray(steps) || !steps.length) return [];

  const stages: AgentStage[] = [];
  let currentStageType: AgentStep["type"] | null = null;
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
        case "cat":
          currentStage = {
            type: "codeSearch",
            id: generateId(),
            retrievedCode: [],
          };
          break;
        // TODO: add grep
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
            input: step.input,
            results: step.results,
          });
          break;
        case "cat":
          assertStageType(currentStage, "codeSearch");
          // For codeSearch, we collect multiple steps into the retrievedCode array
          currentStage.retrievedCode.push({
            filepath: step.path,
            code: step.source,
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
 * Converts an array of AgentStage objects back into an array of AgentStep objects
 * This is the inverse operation of convertAgentStepsToStages
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
        stage.queries.forEach((query) => {
          steps.push({
            type: "logSearch",
            timestamp: new Date(),
            input: query.input,
            results: query.results,
          });
        });
        break;
      case "codeSearch":
        // For codeSearch, each retrieved code in the stage becomes a separate codeSearch step
        stage.retrievedCode.forEach((code) => {
          steps.push({
            type: "cat",
            timestamp: new Date(),
            path: code.filepath,
            source: code.code,
          });
        });
        break;
      case "reasoning":
        // For reasoning, create a single reasoning step
        steps.push({
          type: "reasoning",
          timestamp: new Date(),
          content: stage.content,
        });
        break;
      case "review":
        // For review, create a single review step
        steps.push({
          type: "review",
          timestamp: new Date(),
          content: stage.content,
        });
        break;
      case "logPostprocessing":
        // For logPostprocessing, create a single logPostprocessing step
        steps.push({
          type: "logPostprocessing",
          timestamp: new Date(),
          facts: stage.facts,
        });
        break;
      case "codePostprocessing":
        // For codePostprocessing, create a single codePostprocessing step
        steps.push({
          type: "codePostprocessing",
          timestamp: new Date(),
          facts: stage.facts,
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
    stages: convertAgentStepsToStages(message.steps ?? []),
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
      return convertToDesktopUserMessage(message);
    } else {
      return convertToDesktopAssistantMessage(message);
    }
  });
}
