import { useState } from "react";
import api from "../services/api";
import { Artifact, ChatMessage, ContextItem } from "../types";
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
    const thinkingMessageId = generateId();
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        id: thinkingMessageId,
        role: "assistant",
        content: "Thinking...",
        logPostprocessing: null,
        codePostprocessing: null,
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
            if (message.id === thinkingMessageId) {
              return {
                ...message,
                content:
                  response.content || "I processed your request but got no response content.",
                artifacts: artifacts.length > 0 ? artifacts : undefined,
                logPostprocessing: response.logPostprocessing || null,
                codePostprocessing: response.codePostprocessing || null,
              };
            }
            return message;
          })
        );
      } else {
        // Replace the "Thinking..." message with an error message
        setMessages((prevMessages) =>
          prevMessages.map((message) => {
            if (message.id === thinkingMessageId) {
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
          if (message.id === thinkingMessageId) {
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
