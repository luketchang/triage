import { useState } from "react";
import api from "../services/api";
import {
  Artifact,
  ChatMessage,
  ContextItem,
  LogSearchInputCore,
  LogsWithPagination,
} from "../types";
import { createCodeArtifacts, createLogArtifacts } from "../utils/artifactUtils";
import { generateId } from "../utils/formatters";

// Define the chat mode type
export type ChatMode = "agent" | "manual";

export function useChat() {
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [chatMode, setChatMode] = useState<ChatMode>("agent");

  const toggleChatSidebar = () => {
    setIsChatSidebarOpen(!isChatSidebarOpen);

    // When opening the sidebar, clear any previous thinking state
    // to ensure the focus effect works properly
    if (!isChatSidebarOpen && isThinking) {
      setIsThinking(false);
    }
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
      id: generateId(),
      role: "user",
      content: newMessage,
      contextItems: contextItems.length > 0 ? [...contextItems] : undefined,
    };

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
      },
    ]);

    try {
      // Set reasonOnly flag based on chat mode
      const reasonOnly = chatMode === "manual";

      // Aggregate logContext from contextItems
      const logContext: Map<LogSearchInputCore, LogsWithPagination | string> = new Map();

      // Iterate through contextItems to extract log context
      contextItems.forEach((item) => {
        if (item.type === "logSearch") {
          // Extract the input and results from LogSearchPair
          const { input, results } = item.data;
          // Add to the map
          logContext.set(input, results);
        }
      });

      // Clear context items after creating the message with them attached
      setContextItems([]);

      // Invoke the agent with the user's query, logContext, and reasonOnly flag
      const agentResponse = await api.invokeAgent(
        newMessage,
        logContext.size > 0 ? logContext : null,
        { reasonOnly }
      );

      // Remove the thinking message
      setIsThinking(false);
      setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== thinkingMessageId));

      // Extract artifacts from response
      let logArtifacts: Artifact[] = [];
      let codeArtifacts: Artifact[] = [];

      if (agentResponse.data) {
        logArtifacts = createLogArtifacts(agentResponse.data.logPostprocessing);
        codeArtifacts = createCodeArtifacts(agentResponse.data.codePostprocessing);
      }

      const artifacts = [...logArtifacts, ...codeArtifacts];

      // Create a response message with artifacts
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: agentResponse.data?.chatHistory?.join("\n\n") || "I processed your request.",
        artifacts: artifacts.length > 0 ? artifacts : undefined,
      };

      // Update messages with the assistant's response
      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error("Error sending message to agent:", error);

      // Remove the thinking message
      setIsThinking(false);
      setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== thinkingMessageId));

      // Add an error message if the agent invocation fails
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "Sorry, I encountered an error processing your request.",
      };

      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    }
  };

  return {
    isChatSidebarOpen,
    setIsChatSidebarOpen,
    newMessage,
    setNewMessage,
    messages,
    isThinking,
    contextItems,
    setContextItems,
    chatMode,
    toggleChatSidebar,
    toggleChatMode,
    removeContextItem,
    sendMessage,
  };
}
