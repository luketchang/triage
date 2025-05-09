import { HighLevelUpdate, IntermediateUpdate } from "@triage/agent";
import { create } from "zustand";
import api from "../services/api.js";
import { AgentStage, AssistantMessage } from "../types/index.js";
import { assertStageType } from "../utils/agentDesktopConversion.js";
import { CellUpdateManager } from "../utils/CellUpdateManager.js";

interface AgentState {
  // Agent state
  cellManager: CellUpdateManager | null;
  isRegistered: boolean;

  // Actions
  setCellManager: (manager: CellUpdateManager | null) => void;
  registerAgentUpdates: () => void;
  unregisterAgentUpdates: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  // Initial state
  cellManager: null,
  isRegistered: false,

  // Actions
  setCellManager: (manager: CellUpdateManager | null) => {
    const { isRegistered, registerAgentUpdates } = get();

    set({ cellManager: manager });

    // Register for updates if we have a cell manager and aren't already registered
    if (manager && !isRegistered) {
      registerAgentUpdates();
    }
  },

  registerAgentUpdates: () => {
    // Don't register if already registered
    if (get().isRegistered) return;

    const unregister = api.onAgentUpdate((update) => {
      const { cellManager } = get();
      if (!cellManager) return;

      console.info("Received agent update:", update);

      // Process the update based on its type
      if (update.type === "highLevelUpdate") {
        // A new high-level step is starting
        handleHighLevelUpdate(cellManager, update);
      } else if (update.type === "intermediateUpdate") {
        // An intermediate update for an existing step
        handleIntermediateUpdate(cellManager, update);
      }
    });

    // Store the registered state
    set({ isRegistered: true });

    // Return cleanup function
    return unregister;
  },

  unregisterAgentUpdates: () => {
    // This would be called when we no longer need agent updates
    set({ isRegistered: false });
  },
}));

/**
 * Handle a high-level update from the agent
 * Creates a new step in the cell
 */
function handleHighLevelUpdate(cellManager: CellUpdateManager, update: HighLevelUpdate): void {
  cellManager.queueUpdate((assistantMessage) => {
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
        return assistantMessage; // Return unchanged cell if we don't recognize the step type
    }

    // Add the new step to the cell
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
function handleIntermediateUpdate(
  cellManager: CellUpdateManager,
  update: IntermediateUpdate
): void {
  cellManager.queueUpdate((assistantMessage: AssistantMessage) => {
    // Find the step to update
    const stepIndex = assistantMessage.stages.findIndex(
      (stage: AgentStage) => stage.id === update.parentId
    );

    if (stepIndex === -1) {
      console.warn(`Step with ID ${update.parentId} not found`);
      return assistantMessage; // Return unchanged cell if step not found
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
        return assistantMessage; // Return unchanged cell if unknown step type
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
