import { useEffect, useState } from "react";
import api from "../services/api";
import { Artifact, ChatMessage, ContextItem, StreamUpdate } from "../types";
import { createCodeArtifacts, createLogArtifacts } from "../utils/artifact-utils";
import { generateId } from "../utils/formatters";

// Define the chat mode type
export type ChatMode = "agent" | "manual";

export function useChat() {
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [chatMode, setChatMode] = useState<ChatMode>("agent");
  // Add state to track the current thinking message ID
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);

  // Register for agent updates when the component mounts
  useEffect(() => {
    // Only register if we have a thinking message in progress
    if (!thinkingMessageId) return;

    // Register for updates and store the cleanup function
    const unregister = api.onAgentUpdate((update) => {
      setMessages((prevMessages) => {
        // Find the thinking message
        const messageIndex = prevMessages.findIndex((msg) => msg.id === thinkingMessageId);
        if (messageIndex === -1) return prevMessages;

        const message = prevMessages[messageIndex];
        const currentUpdates = message.streamingUpdates || [];

        // Handle the update based on its type
        let newUpdates: StreamUpdate[];

        if (update.type === "highLevelToolCall") {
          // Check if we already have this high-level tool call
          const typedUpdate = update as StreamUpdate & { id: string; tool: string };
          const existingIndex = currentUpdates.findIndex(
            (u) => u.type === "highLevelToolCall" && (u as { id: string }).id === typedUpdate.id
          );

          if (existingIndex === -1) {
            // Add a new high-level tool call with empty children array
            newUpdates = [...currentUpdates, { ...typedUpdate, children: [] }];
          } else {
            // This high-level tool call already exists, don't add it again
            newUpdates = [...currentUpdates];
          }
        } else if (update.type === "intermediateToolCall") {
          // Find the parent high-level tool and add this as a child
          const typedUpdate = update as StreamUpdate & {
            parentId: string;
            tool: string;
            details?: Record<string, any>;
          };

          const parentIndex = currentUpdates.findIndex(
            (u) =>
              u.type === "highLevelToolCall" && (u as { id: string }).id === typedUpdate.parentId
          );

          if (parentIndex !== -1 && "children" in currentUpdates[parentIndex]) {
            // Check if this intermediate tool call already exists in the parent's children
            const parent = currentUpdates[parentIndex] as {
              type: "highLevelToolCall";
              id: string;
              tool: string;
              children: StreamUpdate[];
            };

            // Check if we already have this same intermediate tool call
            const existingChild = parent.children.find(
              (child) =>
                child.type === "intermediateToolCall" &&
                (child as { tool: string }).tool === typedUpdate.tool &&
                JSON.stringify((child as { details?: Record<string, any> }).details) ===
                  JSON.stringify(typedUpdate.details)
            );

            if (!existingChild) {
              // Deep clone the updates array to avoid mutating the state directly
              newUpdates = [...currentUpdates];
              // Add the intermediate tool call to the parent's children
              const parentInNewUpdates = newUpdates[parentIndex] as {
                type: "highLevelToolCall";
                id: string;
                tool: string;
                children: StreamUpdate[];
              };
              parentInNewUpdates.children = [...(parentInNewUpdates.children || []), typedUpdate];
            } else {
              // Don't add duplicate intermediate tool call
              newUpdates = [...currentUpdates];
            }
          } else {
            // If parent not found, just add it at the top level
            // But first check if it's already there
            const existingIndex = currentUpdates.findIndex(
              (u) =>
                u.type === "intermediateToolCall" &&
                (u as { tool: string }).tool === typedUpdate.tool &&
                JSON.stringify((u as { details?: Record<string, any> }).details) ===
                  JSON.stringify(typedUpdate.details)
            );

            if (existingIndex === -1) {
              newUpdates = [...currentUpdates, typedUpdate];
            } else {
              newUpdates = [...currentUpdates];
            }
          }
        } else if (update.type === "response") {
          // For response updates, just add them to the list
          newUpdates = [...currentUpdates, update as StreamUpdate];
        } else {
          // Fallback - just add the update as-is
          newUpdates = [...currentUpdates, update as StreamUpdate];
        }

        // Create the new message with updated streamingUpdates
        const updatedMessage = {
          ...message,
          streamingUpdates: newUpdates,
        };

        // Create a new messages array with the updated message
        const updatedMessages = [...prevMessages];
        updatedMessages[messageIndex] = updatedMessage;

        return updatedMessages;
      });
    });

    // Cleanup the event listener when the component unmounts or when thinkingMessageId changes
    return () => {
      unregister();
    };
  }, [thinkingMessageId]);

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
      id: generateId(),
      role: "user",
      content: newMessage,
      contextItems: contextItems.length > 0 ? [...contextItems] : undefined,
      logPostprocessing: null,
      codePostprocessing: null,
    };

    // Store context items to attach to message
    const contextItemsToAttach = [...contextItems];

    // Clear context items immediately after creating the message
    setContextItems([]);

    // Update the messages state
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    // Clear the input field
    setNewMessage("");

    // Show thinking message
    setIsThinking(true);
    const newThinkingMessageId = generateId();
    setThinkingMessageId(newThinkingMessageId);

    setMessages((prevMessages) => [
      ...prevMessages,
      {
        id: newThinkingMessageId,
        role: "assistant",
        content: "Thinking...",
        logPostprocessing: null,
        codePostprocessing: null,
        streamingUpdates: [], // Initialize empty array for streaming updates
      },
    ]);

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
        // Process artifacts if present
        let artifacts: Artifact[] = [];

        // Convert log search results into log artifacts if present
        if (response.logContext && response.logContext.size > 0) {
          const logArtifacts = createLogArtifacts(response.logContext);
          artifacts = [...artifacts, ...logArtifacts];
        }

        // Convert code snippets into code artifacts if present
        if (response.codeContext && response.codeContext.size > 0) {
          const codeArtifacts = createCodeArtifacts(response.codeContext);
          artifacts = [...artifacts, ...codeArtifacts];
        }

        // Get the "Thinking..." message and replace it with the actual response
        setMessages((prevMessages) =>
          prevMessages.map((message) => {
            if (message.id === newThinkingMessageId) {
              return {
                ...message,
                content:
                  response.content || "I processed your request but got no response content.",
                artifacts: artifacts.length > 0 ? artifacts : undefined,
                logPostprocessing: response.logPostprocessing || null,
                codePostprocessing: response.codePostprocessing || null,
                // Keep the streaming updates in the final message
                streamingUpdates: message.streamingUpdates,
              };
            }
            return message;
          })
        );
      } else {
        // Replace the "Thinking..." message with an error message
        setMessages((prevMessages) =>
          prevMessages.map((message) => {
            if (message.id === newThinkingMessageId) {
              return {
                ...message,
                content:
                  response?.content ||
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

      // Replace the "Thinking..." message with an error message
      setMessages((prevMessages) =>
        prevMessages.map((message) => {
          if (message.id === newThinkingMessageId) {
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
      // Clear the thinking message ID
      setThinkingMessageId(null);
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
