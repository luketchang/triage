import { create } from "zustand";
import api from "../services/api.js";
import { AssistantMessage, Chat, ChatMessage, ContextItem, UserMessage } from "../types/index.js";
import { convertToAgentChatMessages } from "../utils/agentDesktopConversion.js";
import { handleHighLevelUpdate, handleIntermediateUpdate } from "../utils/agentUpdateHandlers.js";
import { generateId } from "../utils/formatters.js";
import { MessageUpdater } from "../utils/MessageUpdater.js";

// Define the Chat store state
interface ChatState {
  // Chat data
  messages: ChatMessage[];
  currentChatId: number | undefined;
  chats: Chat[];
  newMessage: string;
  isThinking: boolean;

  // Context items for current chat
  contextItems: ContextItem[];

  // Current message updater for streaming updates
  messageUpdater: MessageUpdater | null;
  savedMessageIds: Set<string>;

  // Agent update state
  isRegisteredForAgentUpdates: boolean;
  unregisterAgent: (() => void) | null;

  // Agent update functions
  registerForAgentUpdates: () => void;
  unregisterFromAgentUpdates: () => void;

  // Actions
  setNewMessage: (message: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  selectChat: (chatId: number | undefined) => void;
  createChat: () => Promise<number | undefined>;
  loadChats: () => Promise<void>;
  sendMessage: () => Promise<void>;
  deleteChat: (chatId: number) => Promise<void>;
  setContextItems: (items: ContextItem[]) => void;
  removeContextItem: (id: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  messages: [],
  currentChatId: undefined,
  chats: [],
  newMessage: "",
  isThinking: false,
  contextItems: [],
  unregisterAgent: null,
  messageUpdater: null,
  savedMessageIds: new Set<string>(),
  isRegisteredForAgentUpdates: false,

  // Setters
  setNewMessage: (message: string) => set({ newMessage: message }),

  setMessages: (messages: ChatMessage[]) => set({ messages }),

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
          savedMessageIds: savedIds,
        });
      } else {
        set({ messages: [] });
      }
    } catch (error) {
      console.error("Error loading saved messages:", error);
      set({ messages: [] });
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

  loadChats: async () => {
    try {
      const chats = await api.getAllChats();
      set({ chats });
    } catch (error) {
      console.error("Error loading chats:", error);
    }
  },

  sendMessage: async () => {
    const { newMessage, messages, currentChatId, contextItems, isThinking } = get();

    // Don't send if there's no message or if we're already thinking
    if (!newMessage.trim() || isThinking) return;

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
      content: newMessage,
      contextItems: contextItems.length > 0 ? [...contextItems] : undefined,
    };

    updatedMessages = [...updatedMessages, userMessage];

    // Update state with new message and clear input/context
    set({
      messages: updatedMessages,
      newMessage: "",
      contextItems: [],
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

    // Create a message updater to handle updates
    const updater = new MessageUpdater(assistantMessage, (updatedAssistantMessage) => {
      // Update the assistant message with the updated data
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

    set({ messageUpdater: updater });

    // Register for agent updates if not already registered
    get().registerForAgentUpdates();

    try {
      // Call the agent API with message
      const agentChatMessages = convertToAgentChatMessages(updatedMessages);
      const agentMessage = await api.invokeAgent(newMessage, agentChatMessages);

      if (agentMessage && !agentMessage.error) {
        // Update the assistant message with the response
        const { messageUpdater } = get();
        if (messageUpdater) {
          messageUpdater.update((cell) => ({
            ...cell,
            response:
              agentMessage.response || "I processed your request but got no response content.",
            // preserve existing stages from streaming; do not override here
            // TODO: once we add back agent steps we should save
          }));
        }
      } else {
        // Handle error response
        const { messageUpdater } = get();
        if (messageUpdater) {
          messageUpdater.update((cell) => ({
            ...cell,
            response: "Sorry, I encountered an error processing your request.",
            error: agentMessage?.error || "Sorry, I encountered an error processing your request.",
          }));
        }
      }
    } catch (error) {
      console.error("Error in chat API call:", error);

      // Get error message string
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null
            ? JSON.stringify(error)
            : String(error);

      // Update assistant message with error
      const { messageUpdater } = get();
      if (messageUpdater) {
        messageUpdater.update((cell) => ({
          ...cell,
          response: "Sorry, I encountered an error processing your request.",
          error: errorMessage,
        }));
      }
    } finally {
      // Save assistant message
      const state = get();
      console.log("Saving assistant message", JSON.stringify(state.messageUpdater!.getMessage()));
      api.saveAssistantMessage(state.messageUpdater!.getMessage(), state.currentChatId!);

      // Clear thinking state and message updater
      set({
        isThinking: false,
        messageUpdater: null,
      });

      // Unregister from agent updates
      state.unregisterFromAgentUpdates();
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
            savedMessageIds: new Set(),
          });
        }

        // Reload the chat list to update sidebar
        await state.loadChats();
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  },

  setContextItems: (items: ContextItem[]) => set({ contextItems: items }),

  removeContextItem: (id: string) =>
    set((state) => ({
      contextItems: state.contextItems.filter((item) => item.id !== id),
    })),

  /**
   * Register for agent streaming updates
   * This is called when a message is sent and a messageUpdater is created
   */
  registerForAgentUpdates: () => {
    // Don't register if already registered
    if (get().isRegisteredForAgentUpdates) return;

    const unregister = api.onAgentUpdate((update) => {
      const { messageUpdater } = get();
      if (!messageUpdater) return;

      console.info("Received agent update:", update);

      // Process the update based on its type
      if (update.type === "highLevelUpdate") {
        // A new high-level step is starting
        handleHighLevelUpdate(messageUpdater, update);
      } else if (update.type === "intermediateUpdate") {
        // An intermediate update for an existing step
        handleIntermediateUpdate(messageUpdater, update);
      }
    });

    // Store the registered state and unregister function
    set({
      isRegisteredForAgentUpdates: true,
      unregisterAgent: unregister,
    });
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
      isRegisteredForAgentUpdates: false,
      unregisterAgent: null,
    });
  },
}));
