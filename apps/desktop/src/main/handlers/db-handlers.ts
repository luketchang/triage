import { ipcMain } from "electron";
import { DatabaseService } from "../db/service.js";
import { logger } from "@triage/common";

// Single instance of database service
let dbService: DatabaseService | null = null;

/**
 * Set up all IPC handlers related to chat functionality
 */
export function setupDbHandlers(): void {
  logger.info("DB_HANDLERS: Entered setupDbHandlers function (via passed logger).");
  logger.info("Setting up chat handlers... (via passed logger)");

  // Initialize database service
  try {
    logger.info("DB_HANDLERS: Initializing DatabaseService...");
    dbService = new DatabaseService();
    logger.info("DB_HANDLERS: DatabaseService initialized successfully.");
  } catch (error) {
    logger.info("DB_HANDLERS: ERROR Initializing DatabaseService: " + String(error));
    // Decide how to handle this - throw, or let handlers fail gracefully?
    // For now, dbService will remain null, and handlers should check for it.
  }

  // Create a new chat
  ipcMain.handle("db:create-chat", async (): Promise<number | null> => {
    logger.info("IPC: db:create-chat called (via passed logger)");
    if (!dbService) {
      logger.info("IPC: db:create-chat - DB service not available.");
      return null;
    }
    try {
      logger.info("IPC: db:create-chat - Creating a new chat via dbService.");
      const chatId = await dbService.createChat();
      logger.info("IPC: db:create-chat - Created new chat with ID: " + chatId);
      return chatId;
    } catch (error) {
      logger.info("IPC: db:create-chat - ERROR: " + String(error));
      return null;
    }
  });

  // Get all chats
  ipcMain.handle("db:get-all-chats", async (): Promise<{ id: number; createdAt: string }[]> => {
    logger.info("IPC: db:get-all-chats called (via passed logger)");
    if (!dbService) {
      logger.info("IPC: db:get-all-chats - DB service not available.");
      return [];
    }
    try {
      logger.info("IPC: db:get-all-chats - Getting all chats via dbService.");
      const chats = await dbService.getAllChats();
      logger.info(`IPC: db:get-all-chats - Got ${chats.length} chats.`);
      return chats;
    } catch (error) {
      logger.info("IPC: db:get-all-chats - ERROR: " + String(error));
      return [];
    }
  });

  // // Save user message
  // ipcMain.handle(
  //   "db:save-user-message",
  //   async (_, message: UserMessage): Promise<number | null> => {
  //     logger.info("IPC: db:save-user-message called with: " + JSON.stringify(message));
  //     if (!dbService) return null;

  //     // Get or create chat ID
  //     let chatId = await dbService.getLatestChatId();
  //     if (!chatId) {
  //       logger.info("No existing chat found, creating a new one");
  //       chatId = await dbService.createChat();
  //     }

  //     logger.info("Saving user message to chat ID: " + chatId);
  //     const messageId = await dbService.saveUserMessage(message, chatId);
  //     logger.info("User message saved with ID: " + messageId);
  //     return messageId;
  //   }
  // );

  // // Save assistant message
  // ipcMain.handle(
  //   "db:save-assistant-message",
  //   async (_, message: AssistantMessage, chatId: number): Promise<number | null> => {
  //     logger.info("IPC: db:save-assistant-message called");
  //     if (!dbService) return null;

  //     logger.info("Saving assistant message to chat ID: " + chatId);
  //     const messageId = await dbService.saveAssistantMessage(message, chatId);
  //     logger.info("Assistant message saved with ID: " + messageId);
  //     return messageId;
  //   }
  // );

  // // Get chat messages
  // ipcMain.handle("db:get-messages", async (_, chatId: number): Promise<ChatMessage[]> => {
  //   logger.info("IPC: db:get-messages called with chatId: " + chatId);
  //   if (!dbService) return [];

  //   logger.info("Getting messages for chat ID: " + chatId);
  //   const messages = await dbService.getChatMessages(chatId);
  //   logger.info(`Got ${messages.length} messages`);
  //   return messages;
  // });

  // // Delete chat and all its messages
  // ipcMain.handle("db:delete-chat", async (_, chatId: number): Promise<boolean> => {
  //   logger.info("IPC: db:delete-chat called");
  //   if (!dbService) return false;

  //   logger.info("Deleting chat ID: " + chatId);
  //   await dbService.deleteChat(chatId);
  //   logger.info("Chat deleted successfully");
  //   return true;
  // });

  logger.info("All chat handlers registered. (via passed logger)");
}

/**
 * Clean up resources used by chat handlers
 */
export function cleanupDbHandlers(): void {
  logger.info("DB_HANDLERS: cleanupDbHandlers called (via passed logger).");
  if (dbService) {
    dbService.destroy();
    dbService = null;
  }
  // ipcMain.removeHandler("db:save-user-message");
  // ipcMain.removeHandler("db:save-assistant-message");
  // ipcMain.removeHandler("db:get-messages");
  // ipcMain.removeHandler("db:delete-chat");
  // logger.info("DB handlers cleanup complete.");
}
