import { create } from "zustand";
import api from "../services/api.js";
import {
  AssistantMessage,
  Chat,
  ChatMessage,
  ContextItem,
  LogSearchInput,
  MaterializedContextItem,
  RetrieveSentryEventInput,
  UserMessage,
} from "../types/index.js";
import { convertToAgentChatMessages } from "../utils/agentDesktopConversion.js";
import { handleUpdate } from "../utils/agentUpdateHandlers.js";
import { generateId } from "../utils/formatters.js";
import { MessageUpdater } from "../utils/MessageUpdater.js";
import { createSelectors } from "./util.js";

export const NO_CHAT_SELECTED = -1;
export interface ChatDetails {
  messages?: ChatMessage[];
  userInput?: string;
  isThinking?: boolean;
  contextItems?: ContextItem[];
}

interface ChatState {
  // List of all chats
  chats: Chat[];
  // The currently selected chat
  currentChatId: number;
  // Chat details by chatId, only loaded when selected
  chatDetailsById: Record<number, ChatDetails>;

  // Actions
  loadChats: () => Promise<void>;
  createChat: () => Promise<Chat | undefined>;
  selectChat: (chatId: number | undefined) => void;
  deleteChat: (chatId: number) => Promise<boolean>;
  setUserInput: (message: string) => void;
  addContextItem: (item: ContextItem) => void;
  removeContextItem: (index: number) => void;
  sendMessage: () => Promise<void>;
}

const useChatStoreBase = create<ChatState>((set, get) => ({
  // Initial state
  chats: [],
  currentChatId: NO_CHAT_SELECTED,
  chatDetailsById: {
    // Initialize details for when no chat is selected
    [NO_CHAT_SELECTED]: {
      userInput: "",
      contextItems: [],
    },
  },

  loadChats: async () => {
    try {
      const chats = await api.getAllChats();
      set({ chats });
    } catch (error) {
      console.error("Error loading chats:", error);
    }
  },

  createChat: async (): Promise<Chat | undefined> => {
    try {
      const newChat = await api.createChat();
      console.info("Created new chat with ID:", newChat.id);
      set((state) => ({
        chats: [newChat, ...state.chats],
        currentChatId: newChat.id,
      }));
      return newChat;
    } catch (error) {
      console.error("Error creating new chat:", error);
      return undefined;
    }
  },

  selectChat: async (chatId: number | undefined) => {
    set({ currentChatId: chatId });
    // Load messages for selected chat if not already loaded
    if (chatId && get().chatDetailsById[chatId] === undefined) {
      try {
        const messages = await api.loadChatMessages(chatId);
        set((state) => ({
          chatDetailsById: {
            ...state.chatDetailsById,
            [chatId]: {
              messages,
              userInput: "",
              isThinking: false,
              contextItems: [],
            },
          },
        }));
      } catch (error) {
        console.error("Error loading saved messages:", error);
      }
    }
  },

  deleteChat: async (chatId: number) => {
    let success = false;
    try {
      success = await api.deleteChat(chatId);
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
    if (success) {
      set((state) => {
        const newChatDetailsById = { ...state.chatDetailsById };
        delete newChatDetailsById[chatId];
        return {
          currentChatId: state.currentChatId === chatId ? NO_CHAT_SELECTED : state.currentChatId,
          chats: state.chats.filter((chat) => chat.id !== chatId),
          chatDetailsById: newChatDetailsById,
        };
      });
    }
    return success;
  },

  setUserInput: (message: string) => {
    set((state) => ({
      chatDetailsById: {
        ...state.chatDetailsById,
        [state.currentChatId]: {
          ...state.chatDetailsById[state.currentChatId],
          userInput: message,
        },
      },
    }));
  },

  addContextItem: (item) => {
    set((state) => {
      // Always use the current chat ID (which might be NO_CHAT_SELECTED)
      const targetId = state.currentChatId;
      const current = state.chatDetailsById[targetId]?.contextItems ?? [];

      return {
        chatDetailsById: {
          ...state.chatDetailsById,
          [targetId]: {
            ...state.chatDetailsById[targetId],
            contextItems: [...current, item],
          },
        },
      };
    });
  },

  removeContextItem: (index: number) => {
    set((state) => {
      const currentChatId = state.currentChatId;
      const currentChat = state.chatDetailsById[currentChatId];
      const currentItems = currentChat?.contextItems || [];

      return {
        chatDetailsById: {
          ...state.chatDetailsById,
          [currentChatId]: {
            ...state.chatDetailsById[currentChatId],
            contextItems: currentItems.filter((_, i) => i !== index),
          },
        },
      };
    });
  },

  sendMessage: async () => {
    const { currentChatId, chatDetailsById } = get();
    const chatDetails = chatDetailsById[currentChatId];

    // Check if we have pending context items when no chat is selected
    // This is to enable us to send a message with no user input and only context items
    let pendingContextItems: ContextItem[] = [];
    if (currentChatId === NO_CHAT_SELECTED) {
      pendingContextItems = chatDetailsById[NO_CHAT_SELECTED]?.contextItems || [];
    }

    // Use either the current chat's details or empty values if no chat selected
    const userInput = chatDetails?.userInput || "";
    const messages = chatDetails?.messages || [];
    const isThinking = chatDetails?.isThinking || false;
    const contextItems = chatDetails?.contextItems || pendingContextItems;

    // Don't send if there's no message or if we're already thinking
    if ((!userInput?.trim() && (!contextItems || contextItems.length === 0)) || isThinking) return;

    let chatId = currentChatId;
    // If no chat is selected, create a new one
    if (chatId === NO_CHAT_SELECTED) {
      const chat = await get().createChat();
      if (!chat) return; // Failed to create chat
      chatId = chat.id;
    }

    // Materialize context items by fetching logs and issue event details
    const materializedContextItems = await materializeContextItems(contextItems);

    // Create a new user and assistant message
    const userMessage: UserMessage = {
      id: generateId(),
      role: "user",
      timestamp: new Date(),
      content: userInput || "",
      contextItems: materializedContextItems,
    };

    try {
      await api.saveUserMessage(userMessage, chatId);
    } catch (error) {
      console.error("Error saving user message:", error);
    }

    const assistantMessage: AssistantMessage = {
      id: generateId(),
      role: "assistant",
      timestamp: new Date(),
      response: "Thinking...",
      steps: [],
    };
    const updatedMessages = [...(messages || []), userMessage];
    const updatedMessagesWithAssistant = [...updatedMessages, assistantMessage];

    // Update state with new user/assistant message and clear input and context items
    set((state) => {
      const newChatDetailsById = {
        ...state.chatDetailsById,
        [chatId]: {
          ...state.chatDetailsById[chatId],
          messages: updatedMessagesWithAssistant,
          userInput: "",
          contextItems: [],
          isThinking: true,
        },
      };
      // If no chat was selected when the message was sent, we need to clear the
      // user input on the "new chat" screen.
      if (currentChatId === NO_CHAT_SELECTED) {
        delete newChatDetailsById[NO_CHAT_SELECTED];
      }
      return { chatDetailsById: newChatDetailsById };
    });

    // Handle streamed updates from the agent
    const updater = new MessageUpdater(assistantMessage, (updatedAssistantMessage) => {
      set((state) => ({
        chatDetailsById: {
          ...state.chatDetailsById,
          [chatId]: {
            ...state.chatDetailsById[chatId],
            // Update the last assistant message in this chat with updatedAssistantMessage
            messages: state.chatDetailsById[chatId].messages!.map((message) =>
              message.role === "assistant" && message.id === assistantMessage.id
                ? { ...message, ...updatedAssistantMessage }
                : message
            ),
          },
        },
      }));
    });
    const unregisterUpdater = api.onAgentUpdate((update) => {
      console.info("Received agent update:", update);
      handleUpdate(updater, update);
    });

    try {
      // Call the agent API with message
      const agentChatMessages = convertToAgentChatMessages(updatedMessages);
      const agentMessage = await api.invokeAgent(userInput || "", agentChatMessages);

      if (agentMessage && !agentMessage.error) {
        // Update the assistant message with the response
        updater.update((cell) => ({
          ...cell,
          response: agentMessage.response || "I processed your request but got no response.",
          // preserve existing steps from streaming; do not override here
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
      console.log("Saving assistant message", JSON.stringify(updater.getMessage()));
      api.saveAssistantMessage(updater.getMessage(), chatId);

      // Clear thinking state for chat
      set((state) => ({
        chatDetailsById: {
          ...state.chatDetailsById,
          [chatId]: {
            ...state.chatDetailsById[chatId],
            isThinking: false,
          },
        },
      }));

      // Unregister from agent updates
      unregisterUpdater();
    }
  },
}));

/**
 * Materialize context items by fetching logs and issue event details
 * @param contextItems Array of context items to materialize
 * @returns Map of context items to their materialized data
 */
async function materializeContextItems(
  contextItems: ContextItem[]
): Promise<Map<ContextItem, MaterializedContextItem>> {
  const materializedItems = new Map<ContextItem, MaterializedContextItem | undefined>();

  if (!contextItems || contextItems.length === 0) {
    return materializedItems as Map<ContextItem, MaterializedContextItem>;
  }

  // Process each context item in parallel
  await Promise.all(
    contextItems.map(async (item) => {
      try {
        if (item.type === "logSearchInput") {
          // This is a LogSearchInput
          const logSearchInput = item as LogSearchInput;
          const logs = await api.fetchLogs(logSearchInput);
          materializedItems.set(item, logs);
        } else if (item.type === "retrieveSentryEventInput") {
          // This is a RetrieveSentryEventInput
          const sentryEventInput = item as RetrieveSentryEventInput;
          const sentryEvent = await api.fetchSentryEvent(sentryEventInput);
          materializedItems.set(item, sentryEvent);
        } else {
          console.warn("Unknown context item type", { item });
        }
      } catch (error) {
        console.error("Error materializing context item", { error, item });
      }
    })
  );

  // Filter out undefined values for the return type
  return new Map(
    Array.from(materializedItems.entries()).filter(([_, value]) => value !== undefined) as [
      ContextItem,
      MaterializedContextItem,
    ][]
  );
}

export const useChatStore = createSelectors(useChatStoreBase);
