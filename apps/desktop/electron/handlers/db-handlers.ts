import { ipcMain } from "electron";
import { AssistantMessage, ChatMessage, UserMessage } from "../../src/renderer/types/index.js";
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

  // Save user message
  ipcMain.handle(
    "chat:save-user-message",
    async (_, message: UserMessage): Promise<number | null> => {
      console.info("IPC: chat:save-user-message called with:", message);
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
    "chat:save-assistant-message",
    async (_, message: AssistantMessage): Promise<number | null> => {
      console.info("IPC: chat:save-assistant-message called");
      if (!dbService) return null;

      // Get chat ID
      const chatId = await dbService.getLatestChatId();
      if (!chatId) return null;

      console.info("Saving assistant message to chat ID:", chatId);
      const messageId = await dbService.saveAssistantMessage(message, chatId);
      console.info("Assistant message saved with ID:", messageId);
      return messageId;
    }
  );

  // Get chat messages
  ipcMain.handle("chat:get-messages", async (): Promise<ChatMessage[]> => {
    console.info("IPC: chat:get-messages called");
    if (!dbService) return [];

    // Get the latest chat ID
    const chatId = await dbService.getLatestChatId();
    if (!chatId) return [];

    console.info("Getting messages for chat ID:", chatId);
    const messages = await dbService.getChatMessages(chatId);
    console.info(`Got ${messages.length} messages`);
    return messages;
  });

  // Clear current chat
  ipcMain.handle("chat:clear", async (): Promise<boolean> => {
    console.info("IPC: chat:clear called");
    if (!dbService) return false;

    const chatId = await dbService.getLatestChatId();
    if (!chatId) return false;

    console.info("Clearing chat ID:", chatId);
    await dbService.clearChat(chatId);
    console.info("Chat cleared successfully");
    return true;
  });

  console.info("All chat handlers registered.");
}

/**
 * Clean up resources used by chat handlers
 */
export function cleanupDbHandlers(): void {
  console.info("Cleaning up chat handlers...");
  if (dbService) {
    dbService.destroy();
    dbService = null;
  }
  console.info("Chat handlers cleanup complete.");
}
