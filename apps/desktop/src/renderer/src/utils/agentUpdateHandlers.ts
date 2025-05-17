import {
  AgentStep,
  AgentStreamUpdate,
  CodeSearchStep,
  LogSearchStep,
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
    // Find the step to update
    if (update.step.type === "reasoning-chunk") {
      const stepIndex = assistantMessage.steps.findIndex(
        (step: AgentStep) => step.id === update.step.id
      );

      if (stepIndex === -1) {
        return {
          ...assistantMessage,
          steps: [
            ...assistantMessage.steps,
            {
              type: "reasoning",
              timestamp: new Date(),
              id: update.step.id,
              data: update.step.chunk,
            },
          ],
        };
      }

      const existingStep = assistantMessage.steps[stepIndex] as ReasoningStep;
      const updatedStep = {
        ...existingStep,
        data: existingStep.data + update.step.chunk,
      };

      const updatedSteps = [...assistantMessage.steps];
      updatedSteps[stepIndex] = updatedStep;

      return {
        ...assistantMessage,
        steps: updatedSteps,
      };
    } else if (update.step.type === "logSearch-chunk") {
      const stepIndex = assistantMessage.steps.findIndex(
        (step: AgentStep) => step.id === update.step.id
      );

      if (stepIndex === -1) {
        return {
          ...assistantMessage,
          steps: [
            ...assistantMessage.steps,
            {
              type: "logSearch",
              timestamp: new Date(),
              id: update.step.id,
              reasoning: update.step.chunk,
              data: [],
            },
          ],
        };
      }

      const existingStep = assistantMessage.steps[stepIndex] as LogSearchStep;
      const updatedStep = {
        ...existingStep,
        reasoning: existingStep.reasoning + update.step.chunk,
      };

      const updatedSteps = [...assistantMessage.steps];
      updatedSteps[stepIndex] = updatedStep;

      return {
        ...assistantMessage,
        steps: updatedSteps,
      };
    } else if (update.step.type === "codeSearch-chunk") {
      const stepIndex = assistantMessage.steps.findIndex(
        (step: AgentStep) => step.id === update.step.id
      );

      if (stepIndex === -1) {
        return {
          ...assistantMessage,
          steps: [
            ...assistantMessage.steps,
            {
              type: "codeSearch",
              timestamp: new Date(),
              id: update.step.id,
              reasoning: update.step.chunk,
              data: [],
            },
          ],
        };
      }

      const existingStep = assistantMessage.steps[stepIndex] as CodeSearchStep;
      const updatedStep = {
        ...existingStep,
        reasoning: existingStep.reasoning + update.step.chunk,
      };

      const updatedSteps = [...assistantMessage.steps];
      updatedSteps[stepIndex] = updatedStep;

      return {
        ...assistantMessage,
        steps: updatedSteps,
      };
    } else {
      const stepIndex = assistantMessage.steps.findIndex((step) => step.id === update.step.id);
      if (stepIndex === -1) {
        return {
          ...assistantMessage,
          steps: [...assistantMessage.steps, update.step],
        };
      } else {
        const existingStep = assistantMessage.steps[stepIndex];
        const updatedStep = {
          ...existingStep,
          data: update.step.data,
        };

        const updatedSteps = [...assistantMessage.steps];
        updatedSteps[stepIndex] = updatedStep as AgentStep;

        return {
          ...assistantMessage,
          steps: updatedSteps,
        };
      }
    }
  });
}
