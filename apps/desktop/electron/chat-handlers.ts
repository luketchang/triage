import { ipcMain } from "electron";
import { DatabaseService } from "../src/electron/services/database-service.js";
import { AssistantMessage, UserMessage } from "../src/renderer/types/index.js";

let dbService: DatabaseService | null = null;

export function setupChatHandlers(): void {
  // Initialize database service
  dbService = new DatabaseService();

  // Save user message
  ipcMain.handle("chat:save-user-message", async (_, message: UserMessage) => {
    if (!dbService) return null;

    // Get or create chat ID
    let chatId = await dbService.getLatestChatId();
    if (!chatId) {
      chatId = await dbService.createChat();
    }

    return dbService.saveUserMessage(message, chatId);
  });

  // Save assistant message
  ipcMain.handle("chat:save-assistant-message", async (_, message: AssistantMessage) => {
    if (!dbService) return null;

    // Get chat ID
    const chatId = await dbService.getLatestChatId();
    if (!chatId) return null;

    return dbService.saveAssistantMessage(message, chatId);
  });

  // Get chat messages
  ipcMain.handle("chat:get-messages", async () => {
    if (!dbService) return [];

    // Get the latest chat ID
    const chatId = await dbService.getLatestChatId();
    if (!chatId) return [];

    return dbService.getChatMessages(chatId);
  });

  // Clear current chat
  ipcMain.handle("chat:clear", async () => {
    if (!dbService) return false;

    const chatId = await dbService.getLatestChatId();
    if (!chatId) return false;

    await dbService.clearChat(chatId);
    return true;
  });
}

export function cleanupChatHandlers(): void {
  if (dbService) {
    dbService.destroy();
    dbService = null;
  }
}
