import { useEffect, useState } from "react";
import api from "../services/api";
import { AgentStep, Cell, ChatMessage, ContextItem } from "../types";
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
  const handleHighLevelUpdate = (update: {
    type: "highLevelUpdate";
    stepType: string;
    id: string;
  }) => {
    if (!cellManager) return;

    cellManager.queueUpdate((cell) => {
      let newStep: AgentStep;

      // Create the appropriate type of step based on stepType
      switch (update.stepType) {
        case "logSearch":
          newStep = {
            id: update.id,
            type: "logSearch",
            searches: [],
          };
          break;
        case "reasoning":
          newStep = {
            id: update.id,
            type: "reasoning",
            content: "",
          };
          break;
        case "review":
          newStep = {
            id: update.id,
            type: "review",
            content: "",
          };
          break;
        case "logPostprocessing":
          newStep = {
            id: update.id,
            type: "logPostprocessing",
            content: "",
          };
          break;
        case "codePostprocessing":
          newStep = {
            id: update.id,
            type: "codePostprocessing",
            content: "",
          };
          break;
        default:
          console.warn(`Unknown step type: ${update.stepType}`);
          return cell; // Return unchanged cell if we don't recognize the step type
      }

      // Add the new step to the cell
      return {
        ...cell,
        steps: [...cell.steps, newStep],
      };
    });
  };

  /**
   * Handle an intermediate update from the agent
   * Updates the content of an existing step
   */
  const handleIntermediateUpdate = (update: {
    type: "intermediateUpdate";
    stepType: string;
    parentId: string;
    id: string;
    content: string;
  }) => {
    if (!cellManager) return;

    cellManager.queueUpdate((cell) => {
      // Find the step to update
      const stepIndex = cell.steps.findIndex((step) => step.id === update.parentId);
      if (stepIndex === -1) {
        console.warn(`Step with ID ${update.parentId} not found`);
        return cell; // Return unchanged cell if step not found
      }

      const step = cell.steps[stepIndex];

      // Update the step based on its type
      let updatedStep: AgentStep;
      switch (step.type) {
        case "logSearch":
          updatedStep = {
            ...step,
            searches: [...step.searches, update.content],
          };
          break;
        case "reasoning":
          updatedStep = {
            ...step,
            content: step.content + update.content,
          };
          break;
        case "review":
          updatedStep = {
            ...step,
            content: step.content + update.content,
          };
          break;
        case "logPostprocessing":
        // TODO
        case "codePostprocessing":
        // TODO
        default:
          // Type assertion to avoid the "never" type error
          console.warn(`Unknown step type: ${(step as AgentStep).type}`);
          return cell; // Return unchanged cell if unknown step type
      }

      // Create new steps array with the updated step
      const updatedSteps = [...cell.steps];
      updatedSteps[stepIndex] = updatedStep;

      // Return updated cell
      return {
        ...cell,
        steps: updatedSteps,
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
    const userMessage: ChatMessage = {
      role: "user",
      content: newMessage,
      contextItems: contextItems.length > 0 ? [...contextItems] : undefined,
    };

    // Store context items to attach to message
    const contextItemsToAttach = [...contextItems];

    // Clear context items immediately after creating the message
    setContextItems([]);

    // Update the messages state
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    // Clear the input field
    setNewMessage("");

    // Set thinking state
    setIsThinking(true);

    // Create a unique ID for the assistant message
    const cellId = generateId();

    // Create initial cell for streaming updates
    const initialCell: Cell = {
      id: cellId,
      steps: [],
      response: "",
    };

    // Create assistant message with the initial cell
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: "Thinking...",
      cell: initialCell,
    };

    // Add the assistant message to the messages array
    setMessages((prevMessages) => [...prevMessages, assistantMessage]);

    // Create a CellUpdateManager to handle updates to the cell
    const manager = new CellUpdateManager(initialCell, (updatedCell) => {
      // Update the assistant message with the updated cell
      setMessages((prevMessages) =>
        prevMessages.map((message) => {
          if (message.role === "assistant" && message.cell.id === cellId) {
            // Return the message now with the updated cell data
            return {
              ...message,
              cell: updatedCell,
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
      let response;
      if (chatMode === "agent") {
        // Call the agent-powered chat API
        response = await api.agentChat(newMessage, contextItemsToAttach);
      } else {
        // Call the manual chat API (no agent)
        response = await api.manualChat(newMessage, contextItemsToAttach);
      }

      if (response && response.success) {
        // Update the cell with the final response
        manager.queueUpdate((cell) => ({
          ...cell,
          response: response.content || "I processed your request but got no response content.",
          logPostprocessing: response.logPostprocessing || null,
          codePostprocessing: response.codePostprocessing || null,
        }));

        // Also update the message content to match the cell response
        setMessages((prevMessages) =>
          prevMessages.map((message) => {
            if (message.role === "assistant" && message.cell.id === cellId) {
              return {
                ...message,
                content:
                  response.content || "I processed your request but got no response content.",
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
            if (message.role === "assistant" && message.cell.id === cellId) {
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
          if (message.role === "assistant" && message.cell.id === cellId) {
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
