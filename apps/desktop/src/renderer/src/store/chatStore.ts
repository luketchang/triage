import { create } from "zustand";
import api from "../services/api.js";
import {
  AssistantMessage,
  Chat,
  ChatMessage,
  ContextItem,
  MaterializedContextItem,
  UserMessage,
} from "../types/index.js";
import {
  convertToAgentChatMessages,
  convertToAgentUserMessage,
} from "../utils/agentDesktopConversion.js";
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
    const state = get();
    const { currentChatId, chatDetailsById } = state;
    const details = chatDetailsById[currentChatId] || {};
    const { userInput = "", contextItems = [], isThinking = false, messages = [] } = details;

    // Don't send if already in progress or no content
    if (isThinking || (!userInput.trim() && contextItems.length === 0)) {
      return;
    }

    // Ensure we have a real materialized chat ID
    let chatId = currentChatId;
    if (chatId === NO_CHAT_SELECTED) {
      const newChat = await state.createChat();
      if (!newChat) return;
      chatId = newChat.id;
    }

    // Build user and assistant messages
    const userMessage: UserMessage = {
      id: generateId(),
      role: "user",
      timestamp: new Date(),
      content: userInput.trim(),
      contextItems,
      materializedContextItems: [], // Don't wait to materialize context items for updating UI
    };
    const assistantMessage: AssistantMessage = {
      id: generateId(),
      role: "assistant",
      timestamp: new Date(),
      response: "Thinking...",
      steps: [],
    };

    // Optimistically update UI state to clear current input and add user message + empty assistant message
    set((s) => {
      const existing = s.chatDetailsById[chatId] || { messages: [] };
      return {
        chatDetailsById: {
          ...s.chatDetailsById,
          [chatId]: {
            ...existing,
            messages: [...(existing.messages || []), userMessage, assistantMessage],
            userInput: "",
            contextItems: [],
            isThinking: true,
          },
        },
      };
    });

    // Materialize context items
    const materialized = await materializeContextItems(contextItems);
    userMessage.materializedContextItems = materialized;
    console.info("Materialized context items:", materialized);

    // Persist user message
    try {
      await api.saveUserMessage(userMessage, chatId);
    } catch (err) {
      console.error("Error saving user message:", err);
    }

    // Handle streamed assistant updates
    const updater = new MessageUpdater(assistantMessage, (updated) => {
      set((s) => {
        const chat = s.chatDetailsById[chatId];
        return {
          chatDetailsById: {
            ...s.chatDetailsById,
            [chatId]: {
              ...chat,
              messages: chat.messages!.map((m) =>
                m.id === assistantMessage.id ? { ...m, ...updated } : m
              ),
            },
          },
        };
      });
    });
    const unregister = api.onAgentUpdate((update) => {
      console.info("Received agent update:", update);
      handleUpdate(updater, update);
    });

    try {
      // Invoke agent with full conversation
      const agentUserMessage = convertToAgentUserMessage(userMessage);
      const agentMessages = convertToAgentChatMessages([...messages, userMessage]);

      console.info("Calling with user message:", agentUserMessage);
      const agentResponse = await api.invokeAgent(agentUserMessage, agentMessages);

      if (agentResponse?.error) {
        updater.update((cell) => ({
          ...cell,
          response: "Sorry, there was an error processing your request.",
          error: agentResponse.error,
        }));
      } else {
        updater.update((cell) => ({
          ...cell,
          response: agentResponse.response || "No response from agent.",
        }));
      }
    } catch (err) {
      console.error("Agent call error:", err);
      updater.update((cell) => ({
        ...cell,
        response: "Sorry, there was an error processing your request.",
        error: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      // Persist assistant message and clear thinking state
      const finalMessage = updater.getMessage();
      api.saveAssistantMessage(finalMessage, chatId);
      set((s) => ({
        chatDetailsById: {
          ...s.chatDetailsById,
          [chatId]: {
            ...s.chatDetailsById[chatId],
            isThinking: false,
          },
        },
      }));
      unregister();
    }
  },
}));

/**
 * Materialize context items by fetching logs and issue event details
 * @param contextItems Array of context items to materialize
 * @returns Array of materialized context items
 */
async function materializeContextItems(
  contextItems: ContextItem[]
): Promise<MaterializedContextItem[]> {
  const materializedItems: MaterializedContextItem[] = [];

  if (!contextItems || contextItems.length === 0) {
    return materializedItems;
  }

  // Process each context item in parallel
  await Promise.all(
    contextItems.map(async (item) => {
      try {
        if (item.type === "logSearchInput") {
          const logs = await api.fetchLogs(item);
          materializedItems.push({ type: "log", input: item, output: logs });
        } else if (item.type === "retrieveSentryEventInput") {
          const sentryEvent = await api.fetchSentryEvent(item);
          materializedItems.push({ type: "sentry", input: item, output: sentryEvent });
        } else {
          console.error("Unknown context item type", { item });
        }
      } catch (error) {
        console.error("Error materializing context item. Skipping insertion.", { error, item });
      }
    })
  );

  // Filter out undefined values for the return type
  return materializedItems;
}

export const useChatStore = createSelectors(useChatStoreBase);
