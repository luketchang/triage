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
    let newStage: AgentStage;

    // Create the appropriate type of step based on stepType
    switch (update.stepType) {
      case "logSearch":
        newStage = {
          id: update.id,
          type: "logSearch",
          queries: [],
        };
        break;
      case "reasoning":
        newStage = {
          id: update.id,
          type: "reasoning",
          content: "",
        };
        break;
      case "review":
        newStage = {
          id: update.id,
          type: "review",
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
        console.warn(`Unknown step type: ${update.stepType}`);
        return assistantMessage; // Return unchanged message if we don't recognize the step type
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
          queries: [...stage.queries, update.step],
        };
        break;
      }
      case "reasoning": {
        assertStageType(stage, "reasoning");
        updatedStage = {
          ...stage,
          content: stage.content + update.step.contentChunk,
        };
        break;
      }
      case "review": {
        assertStageType(stage, "review");
        updatedStage = {
          ...stage,
          content: stage.content + update.step.contentChunk,
        };
        break;
      }
      case "logPostprocessing": {
        assertStageType(stage, "logPostprocessing");
        updatedStage = {
          ...stage,
          facts: update.step.facts,
        };
        break;
      }
      case "codePostprocessing": {
        assertStageType(stage, "codePostprocessing");
        updatedStage = {
          ...stage,
          facts: update.step.facts,
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
