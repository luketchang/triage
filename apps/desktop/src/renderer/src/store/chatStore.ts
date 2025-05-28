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
  cancelStream?: () => void;
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
    let materializedChatId = currentChatId;
    if (materializedChatId === NO_CHAT_SELECTED) {
      const newChat = await state.createChat();
      if (!newChat) return;
      materializedChatId = newChat.id;
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
    set((state) => {
      const newChatDetailsById = {
        ...state.chatDetailsById,
        [materializedChatId]: {
          ...state.chatDetailsById[materializedChatId],
          messages: [
            ...(state.chatDetailsById[materializedChatId]?.messages || []),
            userMessage,
            assistantMessage,
          ],
          userInput: "",
          contextItems: [],
          isThinking: true,
        },
      };

      // Delete/reset the "new chat" state if we were in it
      if (currentChatId === NO_CHAT_SELECTED) {
        delete newChatDetailsById[NO_CHAT_SELECTED];
      }
      return { chatDetailsById: newChatDetailsById };
    });

    // Materialize context items
    const materialized = await fetchContextItems(contextItems);
    userMessage.materializedContextItems = materialized;
    console.info("Materialized context items:", materialized);

    // Persist user message
    try {
      await api.saveUserMessage(userMessage, materializedChatId);
    } catch (err) {
      console.error("Error saving user message:", err);
    }

    // Handle streamed assistant updates
    const updater = new MessageUpdater(assistantMessage, (updated) => {
      set((state) => {
        const chat = state.chatDetailsById[materializedChatId];
        return {
          chatDetailsById: {
            ...state.chatDetailsById,
            [materializedChatId]: {
              ...chat,
              messages: chat.messages!.map((m) =>
                m.id === assistantMessage.id ? { ...m, ...updated } : m
              ),
            },
          },
        };
      });
    });

    try {
      // Invoke agent with full conversation
      const agentUserMessage = convertToAgentUserMessage(userMessage);
      const agentMessages = convertToAgentChatMessages([...messages, userMessage]);

      console.info("Calling with user message:", agentUserMessage);
      const stream = await api.invokeAgentAsStream(agentUserMessage, agentMessages);

      // Store the stream's cancel function
      set((state) => ({
        chatDetailsById: {
          ...state.chatDetailsById,
          [materializedChatId]: {
            ...state.chatDetailsById[materializedChatId],
            cancelStream: stream.cancel,
          },
        },
      }));

      // Process the stream
      for await (const update of stream) {
        console.info("Received agent update:", update);
        handleUpdate(updater, update);
      }

      // Final update based on the last response
      updater.update((cell) => ({
        ...cell,
        response: cell.response !== "Thinking..." ? cell.response : "I processed your request.",
      }));
    } catch (error) {
      console.error("Error in chat API call:", error);
      // Handle error response
      updater.update((cell) => ({
        ...cell,
        response: "Sorry, there was an error processing your request.",
        error: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      // Persist assistant message and clear pending chat's in-progress state
      console.log("Saving assistant message", JSON.stringify(updater.getMessage()));
      api.saveAssistantMessage(updater.getMessage(), materializedChatId);
      set((state) => ({
        chatDetailsById: {
          ...state.chatDetailsById,
          [materializedChatId]: {
            ...state.chatDetailsById[materializedChatId],
            isThinking: false,
            cancelStream: undefined,
          },
        },
      }));
    }
  },
}));

/**
 * Materialize context items by fetching logs and issue event details
 * @param contextItems Array of context items to materialize
 * @returns Array of materialized context items
 */
async function fetchContextItems(contextItems: ContextItem[]): Promise<MaterializedContextItem[]> {
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
        } else if (item.type === "getSentryEventInput") {
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
