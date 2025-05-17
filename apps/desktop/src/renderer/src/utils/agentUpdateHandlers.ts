import {
  AgentStep,
  AgentStreamUpdate,
  CodePostprocessingStep,
  CodeSearchStep,
  LogPostprocessingStep,
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
    // TODO: DRY UP!
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
    } else if (update.step.type === "logSearch-tools") {
      const stepIndex = assistantMessage.steps.findIndex((step) => step.id === update.step.id);
      if (stepIndex === -1) {
        // Ignore tool calls for unknown steps
        return {
          ...assistantMessage,
          steps: [
            ...assistantMessage.steps,
            {
              type: "logSearch",
              id: update.step.id,
              timestamp: new Date(),
              reasoning: "",
              data: update.step.toolCalls,
            },
          ],
        };
      }

      const existingStep = assistantMessage.steps[stepIndex] as LogSearchStep;
      const updatedStep = {
        ...existingStep,
        data: existingStep.data.concat(update.step.toolCalls),
      };

      const updatedSteps = [...assistantMessage.steps];
      updatedSteps[stepIndex] = updatedStep;

      return {
        ...assistantMessage,
        steps: updatedSteps,
      };
    } else if (update.step.type === "codeSearch-tools") {
      const stepIndex = assistantMessage.steps.findIndex((step) => step.id === update.step.id);
      if (stepIndex === -1) {
        // Ignore tool calls for unknown steps
        return {
          ...assistantMessage,
          steps: [
            ...assistantMessage.steps,
            {
              type: "codeSearch",
              id: update.step.id,
              timestamp: new Date(),
              reasoning: "",
              data: update.step.toolCalls,
            },
          ],
        };
      }

      const existingStep = assistantMessage.steps[stepIndex] as CodeSearchStep;
      const updatedStep = {
        ...existingStep,
        data: existingStep.data.concat(update.step.toolCalls),
      };

      const updatedSteps = [...assistantMessage.steps];
      updatedSteps[stepIndex] = updatedStep;

      return {
        ...assistantMessage,
        steps: updatedSteps,
      };
    } else if (update.step.type === "logPostprocessing") {
      const stepIndex = assistantMessage.steps.findIndex((step) => step.id === update.step.id);
      if (stepIndex === -1) {
        return {
          ...assistantMessage,
          steps: [...assistantMessage.steps, update.step],
        };
      }

      const existingStep = assistantMessage.steps[stepIndex] as LogPostprocessingStep;
      const updatedStep = {
        ...existingStep,
        data: existingStep.data.concat(update.step.data),
      };

      const updatedSteps = [...assistantMessage.steps];
      updatedSteps[stepIndex] = updatedStep;

      return {
        ...assistantMessage,
        steps: updatedSteps,
      };
    } else if (update.step.type === "codePostprocessing") {
      const stepIndex = assistantMessage.steps.findIndex((step) => step.id === update.step.id);
      if (stepIndex === -1) {
        return {
          ...assistantMessage,
          steps: [...assistantMessage.steps, update.step],
        };
      }

      const existingStep = assistantMessage.steps[stepIndex] as CodePostprocessingStep;
      const updatedStep = {
        ...existingStep,
        data: existingStep.data.concat(update.step.data),
      };

      const updatedSteps = [...assistantMessage.steps];
      updatedSteps[stepIndex] = updatedStep;

      return {
        ...assistantMessage,
        steps: updatedSteps,
      };
    } else {
      throw new Error(`Unknown step type: ${update.step}`);
    }
  });
}
