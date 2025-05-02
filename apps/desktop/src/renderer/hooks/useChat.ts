import { HighLevelUpdate, IntermediateUpdate } from "@triage/agent";
import { useEffect, useState } from "react";
import api from "../services/api";
import { AgentStage, AssistantMessage, ChatMessage, ContextItem, UserMessage } from "../types";
import {
  assertStageType,
  convertAgentStepsToStages,
  convertToAgentChatMessages,
} from "../utils/agentDesktopConversion";
import { CellUpdateManager } from "../utils/CellUpdateManager";
import { generateId } from "../utils/formatters";

// Define the chat mode type
export type ChatMode = "agent" | "manual";

export function useChat() {
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [chatMode, setChatMode] = useState<ChatMode>("agent");
  // Track the current cell manager for active streaming responses
  const [cellManager, setCellManager] = useState<CellUpdateManager | null>(null);

  // Register for agent updates when we have an active cell manager
  useEffect(() => {
    if (!cellManager) return;

    // Register for updates and store the cleanup function
    const unregister = api.onAgentUpdate((update) => {
      console.info("Received agent update:", update);

      // Process the update based on its type
      if (update.type === "highLevelUpdate") {
        // A new high-level step is starting (logSearch, reasoning, etc.)
        handleHighLevelUpdate(update);
      } else if (update.type === "intermediateUpdate") {
        // An intermediate update for an existing step
        handleIntermediateUpdate(update);
      }
    });

    return () => {
      unregister();
    };
  }, [cellManager]);

  /**
   * Handle a high-level update from the agent
   * Creates a new step in the cell
   */
  const handleHighLevelUpdate = (update: HighLevelUpdate) => {
    if (!cellManager) return;

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
  };

  /**
   * Handle an intermediate update from the agent
   * Updates the content of an existing step
   */
  const handleIntermediateUpdate = (update: IntermediateUpdate) => {
    if (!cellManager) return;

    cellManager.queueUpdate((assistantMessage) => {
      // Find the step to update
      const stepIndex = assistantMessage.stages.findIndex(
        (stage: AgentStage) => stage.id === update.parentId
      );
      if (stepIndex === -1) {
        console.warn(`Step with ID ${update.parentId} not found`);
        return assistantMessage; // Return unchanged cell if step not found
      }

      let stage = assistantMessage.stages[stepIndex];

      // Update the step based on its type using a type guard helper
      let updatedStage: AgentStage;

      // Helper types and assertion

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

      // Create new steps array with the updated step
      const updatedStages = [...assistantMessage.stages];
      updatedStages[stepIndex] = updatedStage;

      // Return updated cell
      return {
        ...assistantMessage,
        stages: updatedStages,
      };
    });
  };

  const toggleChatMode = () => {
    setChatMode((prevMode) => (prevMode === "agent" ? "manual" : "agent"));
  };

  const removeContextItem = (id: string): void => {
    setContextItems((prev) => prev.filter((item) => item.id !== id));
  };

  const sendMessage = async (): Promise<void> => {
    if (!newMessage.trim()) return;

    // Create a new user message with attached context items
    const userMessage: UserMessage = {
      id: generateId(),
      role: "user",
      timestamp: new Date(),
      content: newMessage,
      contextItems: contextItems.length > 0 ? [...contextItems] : undefined,
    };

    // Store context items to attach to message
    const _contextItemsToAttach = [...contextItems]; // TODO: add this back in once we support attaching context

    // Clear context items immediately after creating the message
    setContextItems([]);

    // Update the messages state
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    // Clear the input field
    setNewMessage("");

    // Set thinking state
    setIsThinking(true);

    // Create assistant message with the initial cell
    const assistantMessage: AssistantMessage = {
      id: generateId(),
      role: "assistant",
      timestamp: new Date(),
      response: "Thinking...",
      stages: [],
    };

    // Add the assistant message to the messages array
    setMessages((prevMessages) => [...prevMessages, assistantMessage]);

    // Create a CellUpdateManager to handle updates to the cell
    const manager = new CellUpdateManager(assistantMessage, (updatedAssistantMessage) => {
      // Update the assistant message with the updated cell
      setMessages((prevMessages) =>
        prevMessages.map((message) => {
          if (message.role === "assistant" && message.id === assistantMessage.id) {
            // Return the message now with the updated cell data
            return {
              ...message,
              stages: updatedAssistantMessage.stages,
            };
          }
          return message;
        })
      );
    });

    // Store the cell manager
    setCellManager(manager);

    try {
      // Determine which API to call based on chat mode
      const agentMessage = await api.invokeAgent(newMessage, convertToAgentChatMessages(messages));

      if (agentMessage && !agentMessage.error) {
        // Update the cell with the final response
        manager.queueUpdate((cell) => ({
          ...cell,
          response:
            agentMessage.response || "I processed your request but got no response content.",
          stages: convertAgentStepsToStages(agentMessage.steps),
        }));

        // When message is done being constructed, update the state once more
        // Also update the message content to match the cell response
        setMessages((prevMessages) =>
          prevMessages.map((message) => {
            if (message.role === "assistant" && message.id === assistantMessage.id) {
              return {
                ...message,
                response: agentMessage.response || message.response,
                stages: convertAgentStepsToStages(agentMessage.steps),
              };
            }
            return message;
          })
        );
      } else {
        // Handle error response
        manager.queueUpdate((cell) => ({
          ...cell,
          error: "Sorry, I encountered an error processing your request. Please try again later.",
        }));

        // Also update the message content with the error
        setMessages((prevMessages) =>
          prevMessages.map((message) => {
            if (message.role === "assistant" && message.id === assistantMessage.id) {
              return {
                ...message,
                content:
                  "Sorry, I encountered an error processing your request. Please try again later.",
              };
            }
            return message;
          })
        );
      }
    } catch (error) {
      // Log the error
      console.error("Error in chat API call:", error);

      // Update the cell with the error
      manager.queueUpdate((cell) => ({
        ...cell,
        error: "Sorry, I encountered an error processing your request. Please try again later.",
      }));

      // Also update the message content with the error
      setMessages((prevMessages) =>
        prevMessages.map((message) => {
          if (message.role === "assistant" && message.id === assistantMessage.id) {
            return {
              ...message,
              content:
                "Sorry, I encountered an error processing your request. Please try again later.",
            };
          }
          return message;
        })
      );
    } finally {
      // Hide the thinking indicator
      setIsThinking(false);
      // Clear the cell manager
      setCellManager(null);
      // Ensure context items are cleared after sending a message
      setContextItems([]);
    }
  };

  return {
    newMessage,
    setNewMessage,
    messages,
    sendMessage,
    isThinking,
    contextItems,
    setContextItems,
    removeContextItem,
    chatMode,
    toggleChatMode,
  };
}
