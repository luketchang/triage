import { ipcMain } from "electron";
import { AssistantMessage, UserMessage } from "../../src/renderer/types/index.js";
import { DatabaseService } from "../db/service.js";

// Single instance of database service
let dbService: DatabaseService | null = null;

/**
 * Set up all IPC handlers related to chat functionality
 */
export function setupDbHandlers(): void {
  console.log("Setting up chat handlers...");

  // Initialize database service
  dbService = new DatabaseService();

  // Debug handler to get database stats
  ipcMain.handle("chat:get-db-stats", async () => {
    console.log("IPC: chat:get-db-stats called");
    if (!dbService) return { error: "Database service not initialized" };
    try {
      const stats = await dbService.getDatabaseStats();
      console.log("Database stats retrieved:", stats);
      return stats;
    } catch (error) {
      console.error("Error getting database stats:", error);
      return { error: String(error) };
    }
  });

  // Save user message
  ipcMain.handle("chat:save-user-message", async (_, message: UserMessage) => {
    console.log("IPC: chat:save-user-message called with:", message);
    if (!dbService) return null;

    // Get or create chat ID
    let chatId = await dbService.getLatestChatId();
    if (!chatId) {
      console.log("No existing chat found, creating a new one");
      chatId = await dbService.createChat();
    }

    console.log("Saving user message to chat ID:", chatId);
    const messageId = await dbService.saveUserMessage(message, chatId);
    console.log("User message saved with ID:", messageId);
    return messageId;
  });

  // Save assistant message
  ipcMain.handle("chat:save-assistant-message", async (_, message: AssistantMessage) => {
    console.log("IPC: chat:save-assistant-message called");
    if (!dbService) return null;

    // Get chat ID
    const chatId = await dbService.getLatestChatId();
    if (!chatId) return null;

    console.log("Saving assistant message to chat ID:", chatId);
    const messageId = await dbService.saveAssistantMessage(message, chatId);
    console.log("Assistant message saved with ID:", messageId);
    return messageId;
  });

  // Get chat messages
  ipcMain.handle("chat:get-messages", async () => {
    console.log("IPC: chat:get-messages called");
    if (!dbService) return [];

    // Get the latest chat ID
    const chatId = await dbService.getLatestChatId();
    if (!chatId) return [];

    console.log("Getting messages for chat ID:", chatId);
    const messages = await dbService.getChatMessages(chatId);
    console.log(`Got ${messages.length} messages`);
    return messages;
  });

  // Clear current chat
  ipcMain.handle("chat:clear", async () => {
    console.log("IPC: chat:clear called");
    if (!dbService) return false;

    const chatId = await dbService.getLatestChatId();
    if (!chatId) return false;

    console.log("Clearing chat ID:", chatId);
    await dbService.clearChat(chatId);
    console.log("Chat cleared successfully");
    return true;
  });

  console.log("All chat handlers registered.");
}

/**
 * Clean up resources used by chat handlers
 */
export function cleanupDbHandlers(): void {
  console.log("Cleaning up chat handlers...");
  if (dbService) {
    dbService.destroy();
    dbService = null;
  }
  console.log("Chat handlers cleanup complete.");
}
