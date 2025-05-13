import { ipcMain } from "electron";
import { AssistantMessage, ChatMessage, UserMessage } from "../../renderer/src/types/index.js";
import { DatabaseService } from "../db/service.js";

// Single instance of database service
let dbService: DatabaseService | null = null;

/**
 * Set up all IPC handlers related to chat functionality
 */
export function setupDbHandlers(): void {
  console.info("Setting up chat handlers...");

  // Initialize database service
  dbService = new DatabaseService();

  // Create a new chat
  ipcMain.handle("db:create-chat", async (): Promise<number | null> => {
    console.info("IPC: db:create-chat called");
    if (!dbService) return null;

    console.info("Creating a new chat");
    const chatId = await dbService.createChat();
    console.info("Created new chat with ID:", chatId);
    return chatId;
  });

  // Get all chats
  ipcMain.handle("db:get-all-chats", async (): Promise<{ id: number; createdAt: string }[]> => {
    console.info("IPC: db:get-all-chats called");
    if (!dbService) return [];

    console.info("Getting all chats");
    const chats = await dbService.getAllChats();
    console.info(`Got ${chats.length} chats`);
    return chats;
  });

  // Save user message
  ipcMain.handle(
    "db:save-user-message",
    async (_, message: UserMessage): Promise<number | null> => {
      console.info("IPC: db:save-user-message called with:", message);
      if (!dbService) return null;

      // Get or create chat ID
      let chatId = await dbService.getLatestChatId();
      if (!chatId) {
        console.info("No existing chat found, creating a new one");
        chatId = await dbService.createChat();
      }

      console.info("Saving user message to chat ID:", chatId);
      const messageId = await dbService.saveUserMessage(message, chatId);
      console.info("User message saved with ID:", messageId);
      return messageId;
    }
  );

  // Save assistant message
  ipcMain.handle(
    "db:save-assistant-message",
    async (_, message: AssistantMessage, chatId: number): Promise<number | null> => {
      console.info("IPC: db:save-assistant-message called");
      if (!dbService) return null;

      console.info("Saving assistant message to chat ID:", chatId);
      const messageId = await dbService.saveAssistantMessage(message, chatId);
      console.info("Assistant message saved with ID:", messageId);
      return messageId;
    }
  );

  // Get chat messages
  ipcMain.handle("db:get-messages", async (_, chatId: number): Promise<ChatMessage[]> => {
    console.info("IPC: db:get-messages called with chatId:", chatId);
    if (!dbService) return [];

    console.info("Getting messages for chat ID:", chatId);
    const messages = await dbService.getChatMessages(chatId);
    console.info(`Got ${messages.length} messages`);
    return messages;
  });

  // Delete chat and all its messages
  ipcMain.handle("db:delete-chat", async (_, chatId: number): Promise<boolean> => {
    console.info("IPC: db:delete-chat called");
    if (!dbService) return false;

    console.info("Deleting chat ID:", chatId);
    await dbService.deleteChat(chatId);
    console.info("Chat deleted successfully");
    return true;
  });

  console.info("All chat handlers registered.");
}

/**
 * Clean up resources used by chat handlers
 */
export function cleanupDbHandlers(): void {
  if (dbService) {
    dbService.destroy();
    dbService = null;
  }
  ipcMain.removeHandler("db:save-user-message");
  ipcMain.removeHandler("db:save-assistant-message");
  ipcMain.removeHandler("db:get-messages");
  ipcMain.removeHandler("db:delete-chat");
  console.info("DB handlers cleanup complete.");
}
