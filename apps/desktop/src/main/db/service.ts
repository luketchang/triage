import BetterSqlite3 from "better-sqlite3";
import { desc, eq } from "drizzle-orm";
import { BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import superjson from "superjson";
import { AgentStep, ChatMessage } from "../../renderer/src/types/index.js";
import { DB_DIR, DB_NAME } from "../constants.js";
import * as schema from "./schema.js";
import { AssistantMessage, Chat, UserMessage } from "./schema.js";

/**
 * Service for interacting with the SQLite database for chat persistence
 */
export class DatabaseService {
  private db: BetterSQLite3Database<typeof schema>;
  private sqliteDb: BetterSqlite3.Database;
  private initialized = false;
  private dbPath: string;

  constructor() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    this.dbPath = path.join(DB_DIR, DB_NAME);
    console.info("DatabaseService: Initializing with database path:", this.dbPath);

    try {
      // Create and store the SQLite database instance
      this.sqliteDb = new BetterSqlite3(this.dbPath);

      // Set pragmas directly on the SQLite instance
      this.sqliteDb.pragma("foreign_keys = ON");
      this.sqliteDb.pragma("journal_mode = WAL");

      // Create the Drizzle instance with our schema
      this.db = drizzle(this.sqliteDb, { schema });
      this.initialize();
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.initialized = true;
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  async createChat(): Promise<Chat> {
    console.info("DatabaseService: Creating new chat");
    try {
      const result = await this.db.insert(schema.chats).values({}).returning();

      if (!result.length || result.length === 0) {
        throw new Error("Failed to create chat - no ID returned");
      }

      console.info("DatabaseService: Created chat with ID:", result[0]!.id);
      return result[0];
    } catch (error) {
      console.error("Error creating chat:", error);
      throw error;
    }
  }

  async getAllChats(): Promise<Chat[]> {
    console.info("DatabaseService: Getting all chats");
    try {
      const chats = await this.db
        .select({
          id: schema.chats.id,
          createdAt: schema.chats.createdAt,
        })
        .from(schema.chats)
        .orderBy(desc(schema.chats.id));

      console.info(`DatabaseService: Got ${chats.length} chats`);
      return chats;
    } catch (error) {
      console.error("Error getting all chats:", error);
      return [];
    }
  }

  async getLatestChatId(): Promise<number | null> {
    try {
      const result = await this.db
        .select({ id: schema.chats.id })
        .from(schema.chats)
        .orderBy(desc(schema.chats.id))
        .limit(1);

      console.info("DatabaseService: Latest chat ID:", result[0]?.id || "none");
      return result[0]?.id || null;
    } catch (error) {
      console.error("Error getting latest chat ID:", error);
      return null;
    }
  }

  async saveUserMessage(message: any, chatId: number): Promise<number> {
    console.info("DatabaseService: Saving user message for chat ID:", chatId);
    try {
      const result = await this.db
        .insert(schema.userMessages)
        .values({
          chatId,
          timestamp: message.timestamp.toISOString(),
          content: message.content,
          contextItems: message.contextItems ? superjson.stringify(message.contextItems) : null,
        })
        .returning();

      if (!result.length || result.length === 0) {
        throw new Error("Failed to save user message - no ID returned");
      }

      console.info("DatabaseService: Saved user message with ID:", result[0]!.id);
      return result[0]!.id;
    } catch (error) {
      console.error("Error saving user message:", error);
      throw error;
    }
  }

  async saveAssistantMessage(message: any, chatId: number): Promise<number> {
    console.info("DatabaseService: Saving assistant message for chat ID:", chatId);
    try {
      const result = await this.db
        .insert(schema.assistantMessages)
        .values({
          chatId,
          timestamp: message.timestamp.toISOString(),
          response: message.response,
          steps: superjson.stringify(message.steps),
          error: message.error || null,
        })
        .returning();

      if (!result.length || result.length === 0) {
        throw new Error("Failed to save assistant message - no ID returned");
      }

      console.info("DatabaseService: Saved assistant message with ID:", result[0]!.id);
      return result[0]!.id;
    } catch (error) {
      console.error("Error saving assistant message:", error);
      throw error;
    }
  }

  async getChatMessages(chatId: number): Promise<ChatMessage[]> {
    try {
      const userMessages = await this.db
        .select()
        .from(schema.userMessages)
        .where(eq(schema.userMessages.chatId, chatId));

      const assistantMessages = await this.db
        .select()
        .from(schema.assistantMessages)
        .where(eq(schema.assistantMessages.chatId, chatId));

      const messages = [
        ...userMessages.map((row: UserMessage) => ({
          id: row.id.toString(),
          chatId: row.chatId,
          role: "user" as const,
          timestamp: new Date(row.timestamp),
          content: row.content,
          contextItems: row.contextItems ? superjson.parse(row.contextItems) : undefined,
        })),
        ...assistantMessages.map((row: AssistantMessage) => ({
          id: row.id.toString(),
          chatId: row.chatId,
          role: "assistant" as const,
          timestamp: new Date(row.timestamp),
          response: row.response,
          steps: superjson.parse(row.steps) as AgentStep[],
          error: row.error || undefined,
        })),
      ];

      // Sort by timestamp
      return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      console.error("Error getting chat messages:", error);
      return [];
    }
  }

  async deleteChat(chatId: number): Promise<void> {
    // Delete messages first (due to foreign key constraints)
    await this.db.transaction(async (tx) => {
      await tx.delete(schema.userMessages).where(eq(schema.userMessages.chatId, chatId));
      await tx.delete(schema.assistantMessages).where(eq(schema.assistantMessages.chatId, chatId));
      await tx.delete(schema.chats).where(eq(schema.chats.id, chatId));
    });
  }

  async destroy(): Promise<void> {
    try {
      if (this.sqliteDb) {
        this.sqliteDb.close();
      }
    } catch (error) {
      console.error("Error destroying database connection:", error);
    }
  }
}
