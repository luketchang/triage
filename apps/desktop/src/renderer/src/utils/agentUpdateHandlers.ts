import { HighLevelUpdate, IntermediateUpdate } from "@triage/agent";
import { AgentStage, AssistantMessage } from "../types/index.js";
import { assertStageType } from "./agentDesktopConversion.js";
import { MessageUpdater } from "./MessageUpdater.js";

/**
 * Handle a high-level update from the agent
 * Creates a new step in the message
 */
export function handleHighLevelUpdate(
  messageUpdater: MessageUpdater,
  update: HighLevelUpdate
): void {
  messageUpdater.update((assistantMessage) => {
    const existingStageIndex = assistantMessage.stages.findIndex((stage) => stage.id === update.id);
    if (existingStageIndex !== -1) {
      console.warn(`Stage with ID ${update.id} already exists, skipping duplicate`);
      return assistantMessage;
    }

    let newStage: AgentStage;
    switch (update.stage) {
      case "logSearch":
        newStage = {
          id: update.id,
          type: "logSearch",
          steps: [],
        };
        break;
      case "codeSearch":
        newStage = {
          id: update.id,
          type: "codeSearch",
          steps: [],
        };
        break;
      case "reasoning":
        newStage = {
          id: update.id,
          type: "reasoning",
          content: "",
        };
        break;
      case "logPostprocessing":
        newStage = {
          id: update.id,
          type: "logPostprocessing",
          facts: [],
        };
        break;
      case "codePostprocessing":
        newStage = {
          id: update.id,
          type: "codePostprocessing",
          facts: [],
        };
        break;
      default:
        console.warn(`Unknown step type: ${update.stage}`);
        return assistantMessage;
    }

    // Add the new step to the message
    return {
      ...assistantMessage,
      stages: [...assistantMessage.stages, newStage],
    };
  });
}

/**
 * Handle an intermediate update from the agent
 * Updates the content of an existing step
 */
export function handleIntermediateUpdate(
  messageUpdater: MessageUpdater,
  update: IntermediateUpdate
): void {
  messageUpdater.update((assistantMessage: AssistantMessage) => {
    // Find the step to update
    const stepIndex = assistantMessage.stages.findIndex(
      (stage: AgentStage) => stage.id === update.parentId
    );

    if (stepIndex === -1) {
      console.warn(`Step with ID ${update.parentId} not found`);
      return assistantMessage; // Return unchanged message if step not found
    }

    const stage = assistantMessage.stages[stepIndex];
    let updatedStage: AgentStage;

    // Update the step based on its type
    switch (update.step.type) {
      case "logSearch": {
        assertStageType(stage, "logSearch");
        updatedStage = {
          ...stage,
          steps: [...stage.steps, update.step],
        };
        break;
      }
      case "codeSearch": {
        assertStageType(stage, "codeSearch");
        updatedStage = {
          ...stage,
          steps: [...stage.steps, update.step],
        };
        break;
      }
      case "reasoning": {
        assertStageType(stage, "reasoning");
        updatedStage = {
          ...stage,
          content: stage.content + update.step.chunk,
        };
        break;
      }
      case "logPostprocessing": {
        assertStageType(stage, "logPostprocessing");
        updatedStage = {
          ...stage,
          facts: update.step.data,
        };
        break;
      }
      case "codePostprocessing": {
        assertStageType(stage, "codePostprocessing");
        updatedStage = {
          ...stage,
          facts: update.step.data,
        };
        break;
      }
      default:
        console.warn(`Unknown stage type: ${(stage as AgentStage).type}`);
        return assistantMessage; // Return unchanged message if unknown step type
    }

    // Create new stages array with the updated step
    const updatedStages = [...assistantMessage.stages];
    updatedStages[stepIndex] = updatedStage;

    // Return updated message
    return {
      ...assistantMessage,
      stages: updatedStages,
    };
  });
}
