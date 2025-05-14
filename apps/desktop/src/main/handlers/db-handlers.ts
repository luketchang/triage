import { ipcMain } from "electron";
import { DatabaseService } from "../db/service.js";
import { logger } from "@triage/common";

// Single instance of database service
let dbService: DatabaseService | null = null;

/**
 * Set up all IPC handlers related to chat functionality
 */
export function setupDbHandlers(): void {
  logger.info("Setting up database handlers...");

  // Initialize database service
  try {
    dbService = new DatabaseService();
  } catch (error) {
    logger.error("Error initializing DatabaseService:", error);
    // For now, dbService will remain null, and handlers should check for it.
  }

  // Create a new chat
  ipcMain.handle("db:create-chat", async (): Promise<number | null> => {
    if (!dbService) {
      logger.warn("db:create-chat - DB service not available");
      return null;
    }
    try {
      const chatId = await dbService.createChat();
      return chatId;
    } catch (error) {
      logger.error("Error creating chat:", error);
      return null;
    }
  });

  // Get all chats
  ipcMain.handle("db:get-all-chats", async (): Promise<{ id: number; createdAt: string }[]> => {
    if (!dbService) {
      logger.warn("db:get-all-chats - DB service not available");
      return [];
    }
    try {
      const chats = await dbService.getAllChats();
      return chats;
    } catch (error) {
      logger.error("Error getting all chats:", error);
      return [];
    }
  });

  // Save user message
  ipcMain.handle("db:save-user-message", async (_, message: any): Promise<number | null> => {
    if (!dbService) return null;

    // Get or create chat ID
    let chatId = await dbService.getLatestChatId();
    if (!chatId) {
      chatId = await dbService.createChat();
    }

    const messageId = await dbService.saveUserMessage(message, chatId);
    return messageId;
  });

  // Save assistant message
  ipcMain.handle(
    "db:save-assistant-message",
    async (_, message: any, chatId: number): Promise<number | null> => {
      if (!dbService) return null;

      const messageId = await dbService.saveAssistantMessage(message, chatId);
      return messageId;
    }
  );

  // Get chat messages
  ipcMain.handle("db:get-messages", async (_, chatId: number): Promise<any[]> => {
    if (!dbService) return [];

    const messages = await dbService.getChatMessages(chatId);
    return messages;
  });

  // Delete chat and all its messages
  ipcMain.handle("db:delete-chat", async (_, chatId: number): Promise<boolean> => {
    if (!dbService) return false;

    await dbService.deleteChat(chatId);
    return true;
  });

  logger.info("All database handlers registered.");
}

/**
 * Clean up resources used by database handlers
 */
export function cleanupDbHandlers(): void {
  if (dbService) {
    dbService.destroy();
    dbService = null;
  }

  ipcMain.removeHandler("db:create-chat");
  ipcMain.removeHandler("db:get-all-chats");
  ipcMain.removeHandler("db:save-user-message");
  ipcMain.removeHandler("db:save-assistant-message");
  ipcMain.removeHandler("db:get-messages");
  ipcMain.removeHandler("db:delete-chat");

  logger.info("Database handlers cleanup complete.");
}
