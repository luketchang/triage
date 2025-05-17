import { AgentStep, AgentStreamUpdate } from "@triage/agent";
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
    if (update.step.type === "reasoning") {
      const stepIndex = assistantMessage.steps.findIndex(
        (step: AgentStep) => step.id === update.step.id
      );

      if (stepIndex === -1) {
        console.warn(`Step with ID ${update.step.id} not found`);
        return assistantMessage; // Return unchanged message if step not found
      }

      const updatedStep = {
        ...assistantMessage.steps[stepIndex],
        data: assistantMessage.steps[stepIndex].data + update.step.chunk,
      };

      const updatedSteps = [...assistantMessage.steps];
      updatedSteps[stepIndex] = updatedStep as AgentStep;

      return {
        ...assistantMessage,
        steps: updatedSteps,
      };
    } else {
      return {
        ...assistantMessage,
        steps: [...assistantMessage.steps, update.step],
      };
    }
  });
}
