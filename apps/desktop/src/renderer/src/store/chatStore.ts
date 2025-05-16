import { create } from "zustand";
import api from "../services/api.js";
import { AssistantMessage, Chat, ChatMessage, UserMessage } from "../types/index.js";
import { convertToAgentChatMessages } from "../utils/agentDesktopConversion.js";
import { handleHighLevelUpdate, handleIntermediateUpdate } from "../utils/agentUpdateHandlers.js";
import { generateId } from "../utils/formatters.js";
import { MessageUpdater } from "../utils/MessageUpdater.js";
import { createSelectors } from "./util.js";

interface ChatState {
  // Chat data
  chats: Chat[];
  currentChatId: number | undefined;

  // Chat-specific state
  messages: ChatMessage[];
  userInput: string;
  isThinking: boolean;
  unregisterAgent: (() => void) | null;

  // Agent update functions
  unregisterFromAgentUpdates: () => void;

  // Actions
  loadChats: () => Promise<void>;
  createChat: () => Promise<number | undefined>;
  selectChat: (chatId: number | undefined) => void;
  deleteChat: (chatId: number) => Promise<void>;
  setUserInput: (message: string) => void;
  sendMessage: () => Promise<void>;
}

const useChatStoreBase = create<ChatState>((set, get) => ({
  // Initial state
  chats: [],
  currentChatId: undefined,
  messages: [],
  userInput: "",
  isThinking: false,
  unregisterAgent: null,

  loadChats: async () => {
    try {
      const chats = await api.getAllChats();
      set({ chats });
    } catch (error) {
      console.error("Error loading chats:", error);
    }
  },

  createChat: async (): Promise<number | undefined> => {
    try {
      console.info("Creating new chat via API");
      const newChatId = await api.createChat();

      console.info("Created new chat with ID:", newChatId);
      set({ currentChatId: newChatId });

      // Refresh the chat list
      await get().loadChats();

      return newChatId;
    } catch (error) {
      console.error("Error creating new chat:", error);
      return undefined;
    }
  },

  selectChat: async (chatId: number | undefined) => {
    set({ currentChatId: chatId });

    // If selecting empty chat (0) or undefined, clear messages
    if (!chatId || chatId === 0) {
      set({ messages: [] });
      return;
    }

    // Otherwise, load messages for the selected chat
    try {
      const savedMessages = await api.loadChatMessages(chatId);
      if (savedMessages && savedMessages.length > 0) {
        const savedIds = new Set<string>();
        savedMessages.forEach((msg) => savedIds.add(msg.id));

        set({
          messages: savedMessages,
        });
      } else {
        set({ messages: [] });
      }
    } catch (error) {
      console.error("Error loading saved messages:", error);
      set({ messages: [] });
    }
  },

  deleteChat: async (chatId: number) => {
    try {
      const success = await api.deleteChat(chatId);
      if (success) {
        const state = get();
        // If we're deleting the currently selected chat, reset UI
        if (state.currentChatId === chatId) {
          set({
            currentChatId: undefined,
            messages: [],
          });
        }

        // Reload the chat list to update sidebar
        await state.loadChats();
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  },

  setUserInput: (message: string) => set({ userInput: message }),

  sendMessage: async () => {
    const { userInput, messages, currentChatId, isThinking } = get();

    // Don't send if there's no message or if we're already thinking
    if (!userInput.trim() || isThinking) return;

    let chatId = currentChatId;
    let updatedMessages = [...messages];

    // If no chat is selected or it's the "empty" chat (0), create a new one
    if (!chatId || chatId === 0) {
      chatId = await get().createChat();
      if (chatId === undefined) return; // Failed to create chat
    }

    // Create a new user message with context items
    const userMessage: UserMessage = {
      id: generateId(),
      role: "user",
      timestamp: new Date(),
      content: userInput,
    };

    updatedMessages = [...updatedMessages, userMessage];

    // Update state with new message and clear input/context
    set({
      messages: updatedMessages,
      userInput: "",
      isThinking: true,
    });

    // Save the user message
    try {
      await api.saveUserMessage(userMessage, chatId);
    } catch (error) {
      console.error("Error saving user message:", error);
    }

    // Create assistant message
    const assistantMessage: AssistantMessage = {
      id: generateId(),
      role: "assistant",
      timestamp: new Date(),
      response: "Thinking...",
      stages: [],
    };

    // Add assistant message to chat
    const updatedMessagesWithAssistant = [...updatedMessages, assistantMessage];
    set({ messages: updatedMessagesWithAssistant });

    // Handle streamed updates from the agent
    const updater = new MessageUpdater(assistantMessage, (updatedAssistantMessage) => {
      // Update the latest assistant message with the updated data
      set((state) => ({
        messages: state.messages.map((message) => {
          if (message.role === "assistant" && message.id === assistantMessage.id) {
            return {
              ...message,
              ...updatedAssistantMessage,
            };
          }
          return message;
        }),
      }));
    });
    const unregister = api.onAgentUpdate((update) => {
      console.info("Received agent update:", update);
      if (update.type === "highLevelUpdate") {
        // A new high-level step is starting
        handleHighLevelUpdate(updater, update);
      } else if (update.type === "intermediateUpdate") {
        // An intermediate update for an existing step
        handleIntermediateUpdate(updater, update);
      }
    });
    set({
      unregisterAgent: unregister,
    });

    try {
      // Call the agent API with message
      const agentChatMessages = convertToAgentChatMessages(updatedMessages);
      const agentMessage = await api.invokeAgent(userInput, agentChatMessages);

      if (agentMessage && !agentMessage.error) {
        // Update the assistant message with the response
        updater.update((cell) => ({
          ...cell,
          response: agentMessage.response || "I processed your request but got no response.",
          // preserve existing stages from streaming; do not override here
          // TODO: once we add back agent steps we should save
        }));
      } else {
        // Handle error response
        updater.update((cell) => ({
          ...cell,
          response: "Sorry, there was an error processing your request.",
          error: agentMessage?.error || "Sorry, there was an error processing your request.",
        }));
      }
    } catch (error) {
      console.error("Error in chat API call:", error);
      // Handle error response
      updater.update((cell) => ({
        ...cell,
        response: "Sorry, there was an error processing your request.",
        error:
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null
              ? JSON.stringify(error)
              : String(error),
      }));
    } finally {
      // Save assistant message
      const state = get();
      console.log("Saving assistant message", JSON.stringify(updater.getMessage()));
      api.saveAssistantMessage(updater.getMessage(), state.currentChatId!);

      // Clear thinking state and message updater
      set({
        isThinking: false,
      });

      // Unregister from agent updates
      state.unregisterFromAgentUpdates();
    }
  },

  /**
   * Unregister from agent updates
   * This is called when message processing is complete
   */
  unregisterFromAgentUpdates: () => {
    // Call the unregister function if it exists
    const { unregisterAgent } = get();
    if (unregisterAgent) {
      unregisterAgent();
    }

    // Reset the agent update state
    set({
      unregisterAgent: null,
    });
  },
}));
export const useChatStore = createSelectors(useChatStoreBase);
