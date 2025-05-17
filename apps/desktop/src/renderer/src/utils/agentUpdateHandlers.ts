import {
  AgentStep,
  AgentStreamUpdate,
  CodePostprocessingStep,
  CodeSearchStep,
  CodeSearchToolCallWithResult,
  LogPostprocessingStep,
  LogSearchStep,
  LogSearchToolCallWithResult,
  ReasoningStep,
} from "@triage/agent";
import { AssistantMessage } from "../types/index.js";
import { MessageUpdater } from "./MessageUpdater.js";

/**
 * Handle an intermediate update from the agent
 * Updates the content of an existing step
 */
export function handleIntermediateUpdate(
  messageUpdater: MessageUpdater,
  update: AgentStreamUpdate
): void {
  messageUpdater.update((assistantMessage: AssistantMessage) => {
    const { type, id } = update.step;

    // Handle reasoning chunks
    if (type === "reasoning-chunk") {
      return handleReasoningChunk(assistantMessage, id, update.step.chunk);
    }

    // Handle log search chunks
    if (type === "logSearch-chunk") {
      return handleLogSearchChunk(assistantMessage, id, update.step.chunk);
    }

    // Handle code search chunks
    if (type === "codeSearch-chunk") {
      return handleCodeSearchChunk(assistantMessage, id, update.step.chunk);
    }

    // Handle log search tools
    if (type === "logSearch-tools") {
      return handleLogSearchTools(assistantMessage, id, update.step.toolCalls);
    }

    // Handle code search tools
    if (type === "codeSearch-tools") {
      return handleCodeSearchTools(assistantMessage, id, update.step.toolCalls);
    }

    // Handle postprocessing updates
    if (type === "logPostprocessing" || type === "codePostprocessing") {
      return handlePostprocessingUpdate(assistantMessage, update.step);
    }

    throw new Error(`Unknown step type: ${type}`);
  });
}

/**
 * Common logic for finding a step and returning updated assistant message
 * If updateExistingStepFn is not provided, only new step creation will occur
 */
function findAndUpdateStep<T extends AgentStep>(
  assistantMessage: AssistantMessage,
  stepId: string,
  updateLogic:
    | { createNewStepFn: () => T; updateExistingStepFn?: (step: T) => T }
    | { createNewStepFn?: () => T; updateExistingStepFn: (step: T) => T }
): AssistantMessage {
  const stepIndex = assistantMessage.steps.findIndex((step) => step.id === stepId);

  // If step doesn't exist yet, create a new one
  if (stepIndex === -1) {
    return {
      ...assistantMessage,
      steps: [...assistantMessage.steps, updateLogic.createNewStepFn!()],
    };
  }

  // Otherwise update the existing step
  const existingStep = assistantMessage.steps[stepIndex] as T;
  const updatedStep = updateLogic.updateExistingStepFn!(existingStep);

  const updatedSteps = [...assistantMessage.steps];
  updatedSteps[stepIndex] = updatedStep;

  return {
    ...assistantMessage,
    steps: updatedSteps,
  };
}

/**
 * Handle reasoning chunk updates
 */
function handleReasoningChunk(
  assistantMessage: AssistantMessage,
  stepId: string,
  chunk: string
): AssistantMessage {
  return findAndUpdateStep<ReasoningStep>(assistantMessage, stepId, {
    createNewStepFn: () => ({
      type: "reasoning",
      timestamp: new Date(),
      id: stepId,
      data: chunk,
    }),
    updateExistingStepFn: (step) => ({
      ...step,
      data: step.data + chunk,
    }),
  });
}

/**
 * Handle log search chunk updates
 */
function handleLogSearchChunk(
  assistantMessage: AssistantMessage,
  stepId: string,
  chunk: string
): AssistantMessage {
  return findAndUpdateStep<LogSearchStep>(assistantMessage, stepId, {
    createNewStepFn: () => ({
      type: "logSearch",
      timestamp: new Date(),
      id: stepId,
      reasoning: chunk,
      data: [],
    }),
    updateExistingStepFn: (step) => ({
      ...step,
      reasoning: step.reasoning + chunk,
    }),
  });
}

/**
 * Handle code search chunk updates
 */
function handleCodeSearchChunk(
  assistantMessage: AssistantMessage,
  stepId: string,
  chunk: string
): AssistantMessage {
  return findAndUpdateStep<CodeSearchStep>(assistantMessage, stepId, {
    createNewStepFn: () => ({
      type: "codeSearch",
      timestamp: new Date(),
      id: stepId,
      reasoning: chunk,
      data: [],
    }),
    updateExistingStepFn: (step) => ({
      ...step,
      reasoning: step.reasoning + chunk,
    }),
  });
}

/**
 * Handle log search tools updates
 */
function handleLogSearchTools(
  assistantMessage: AssistantMessage,
  stepId: string,
  toolCalls: LogSearchToolCallWithResult[]
): AssistantMessage {
  return findAndUpdateStep<LogSearchStep>(assistantMessage, stepId, {
    updateExistingStepFn: (step) => ({
      ...step,
      data: toolCalls,
    }),
  });
}

/**
 * Handle code search tools updates
 */
function handleCodeSearchTools(
  assistantMessage: AssistantMessage,
  stepId: string,
  toolCalls: CodeSearchToolCallWithResult[]
): AssistantMessage {
  return findAndUpdateStep<CodeSearchStep>(assistantMessage, stepId, {
    updateExistingStepFn: (step) => ({
      ...step,
      data: toolCalls,
    }),
  });
}

/**
 * Handle postprocessing updates
 */
function handlePostprocessingUpdate(
  assistantMessage: AssistantMessage,
  step: LogPostprocessingStep | CodePostprocessingStep
): AssistantMessage {
  // Use findAndUpdateStep to handle both creation and update cases
  if (step.type === "logPostprocessing") {
    return findAndUpdateStep<LogPostprocessingStep>(assistantMessage, step.id, {
      createNewStepFn: () => step,
    });
  } else {
    // codePostprocessing
    return findAndUpdateStep<CodePostprocessingStep>(assistantMessage, step.id, {
      createNewStepFn: () => step,
    });
  }
}
