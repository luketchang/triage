import { logger } from "@triage/common";
import { ipcMain } from "electron";
import { AssistantMessage, UserMessage } from "../db/schema.js";
import { DatabaseService } from "../db/service.js";

// Single instance of database service
let dbService: DatabaseService | null = null;

/**
 * Set up all IPC handlers related to chat functionality
 */
export function setupDbHandlers(): void {
  logger.info("Setting up database handlers...");

  // Initialize database service
  dbService = new DatabaseService();

  // Create a new chat
  ipcMain.handle("db:create-chat", async (): Promise<number | null> => {
    if (!dbService) {
      logger.warn("db:create-chat - DB service not available");
      return null;
    }

    logger.info("Creating a new chat");
    const chatId = await dbService.createChat();
    logger.info("Created new chat with ID:", chatId);
    return chatId;
  });

  // Get all chats
  ipcMain.handle("db:get-all-chats", async (): Promise<{ id: number; createdAt: string }[]> => {
    if (!dbService) {
      logger.warn("db:get-all-chats - DB service not available");
      return [];
    }

    logger.info("Getting all chats");
    const chats = await dbService.getAllChats();
    logger.info(`Got ${chats.length} chats`);
    return chats;
  });

  // Save user message
  ipcMain.handle(
    "db:save-user-message",
    async (_, message: UserMessage, chatId: number): Promise<number | null> => {
      if (!dbService) return null;

      logger.info("Saving user message to chat ID:", chatId);
      const messageId = await dbService.saveUserMessage(message, chatId);
      return messageId;
    }
  );

  // Save assistant message
  ipcMain.handle(
    "db:save-assistant-message",
    async (_, message: AssistantMessage, chatId: number): Promise<number | null> => {
      if (!dbService) return null;

      logger.info("Saving assistant message to chat ID:", chatId);
      const messageId = await dbService.saveAssistantMessage(message, chatId);
      return messageId;
    }
  );

  // Get chat messages
  ipcMain.handle("db:get-messages", async (_, chatId: number): Promise<any[]> => {
    if (!dbService) return [];

    logger.info("Getting messages for chat ID:", chatId);
    const messages = await dbService.getChatMessages(chatId);
    return messages;
  });

  // Delete chat and all its messages
  ipcMain.handle("db:delete-chat", async (_, chatId: number): Promise<boolean> => {
    if (!dbService) return false;

    logger.info("Deleting chat with ID:", chatId);
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
