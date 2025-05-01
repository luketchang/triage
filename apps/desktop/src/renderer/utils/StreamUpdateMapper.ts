import { v4 as uuidv4 } from "uuid";
import { HighLevelUpdate, IntermediateUpdate, StreamUpdate } from "../types";
import {
  AgentStep,
  LogSearchStep,
  PostprocessingStep,
  ReasoningStep,
  ReviewStep,
} from "../types/cell";
import { CellUpdateManager } from "./AssistantMessageUpdateManager";

/**
 * Creates a new step based on the high-level update type
 */
export function createStepFromHighLevelUpdate(update: HighLevelUpdate): AgentStep {
  const stepType = update.stepType.toLowerCase();

  if (stepType === "logsearch") {
    return {
      id: update.id,
      type: "logSearch",
      status: "in-progress",
      searches: [],
      response: "",
    } as LogSearchStep;
  }

  if (stepType === "reasoning") {
    return {
      id: update.id,
      type: "reasoning",
      status: "in-progress",
      content: "",
    } as ReasoningStep;
  }

  if (stepType === "review") {
    return {
      id: update.id,
      type: "review",
      status: "in-progress",
      content: "",
    } as ReviewStep;
  }

  if (stepType === "logpostprocessing") {
    return {
      id: update.id,
      type: "postprocessing",
      status: "in-progress",
      subtype: "log",
      content: "",
    } as PostprocessingStep;
  }

  if (stepType === "codepostprocessing") {
    return {
      id: update.id,
      type: "postprocessing",
      status: "in-progress",
      subtype: "code",
      content: "",
    } as PostprocessingStep;
  }

  // Default case - treat as reasoning
  return {
    id: update.id,
    type: "reasoning",
    status: "in-progress",
    content: "",
  } as ReasoningStep;
}

/**
 * Updates a step with an intermediate update
 */
export function updateStepWithIntermediateUpdate(
  step: AgentStep,
  update: IntermediateUpdate
): AgentStep {
  // Get step type from the intermediate update
  const stepType = update.stepType.toLowerCase();

  // Handle log search step specially
  if (step.type === "logSearch" && stepType === "logsearch") {
    const logSearchStep = step as LogSearchStep;

    // Extract query details from the content if possible
    let query = "";
    let start = "";
    let end = "";
    let limit = 100;

    // Try to parse the content for query details
    const content = update.content || "";
    if (content.includes("query:")) {
      const queryMatch = content.match(/query:\s*([^,\n]+)/i);
      if (queryMatch) query = queryMatch[1].trim();
    }

    if (content.includes("start:") || content.includes("from:")) {
      const dateMatch = content.match(/(start|from):\s*([^,\n]+)/i);
      if (dateMatch) start = dateMatch[2].trim();
    }

    if (content.includes("end:") || content.includes("to:")) {
      const dateMatch = content.match(/(end|to):\s*([^,\n]+)/i);
      if (dateMatch) end = dateMatch[2].trim();
    }

    if (content.includes("limit:")) {
      const limitMatch = content.match(/limit:\s*(\d+)/i);
      if (limitMatch) limit = parseInt(limitMatch[1]);
    }

    return {
      ...logSearchStep,
      searches: [
        ...logSearchStep.searches,
        {
          id: uuidv4(),
          query,
          start,
          end,
          limit,
          status: "running",
        },
      ],
    };
  }

  // Handle reasoning and review steps - add the content to the existing content
  if (
    (step.type === "reasoning" && stepType === "reasoning") ||
    (step.type === "review" && stepType === "review")
  ) {
    return {
      ...step,
      content: (step as ReasoningStep | ReviewStep).content + update.content,
    };
  }

  // Handle postprocessing steps
  if (
    step.type === "postprocessing" &&
    (stepType === "logpostprocessing" || stepType === "codepostprocessing")
  ) {
    return {
      ...step,
      content: step.content + update.content,
    };
  }

  // Default - if we didn't handle it specifically, return the step unchanged
  return step;
}

/**
 * Main handler for stream updates
 * Maps the updates to cell update operations
 */
export function handleStreamUpdate(update: StreamUpdate, cellManager: CellUpdateManager): void {
  if (update.type === "highLevelUpdate") {
    cellManager.queueUpdate((cell) => {
      // Create a new step based on the step type
      const newStep = createStepFromHighLevelUpdate(update);
      return {
        ...cell,
        steps: [...cell.steps, newStep],
      };
    });
  } else if (update.type === "intermediateUpdate") {
    cellManager.queueUpdate((cell) => {
      // Find the parent step and update it
      return {
        ...cell,
        steps: cell.steps.map((step) =>
          step.id === update.parentId ? updateStepWithIntermediateUpdate(step, update) : step
        ),
        // Also update the main response if we're in a reasoning phase
        // This helps with standalone responses that don't have a parent
        response:
          update.stepType === "reasoning" && !update.parentId
            ? (cell.response || "") + update.content
            : cell.response,
      };
    });
  }
}
