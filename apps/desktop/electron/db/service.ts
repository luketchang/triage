import BetterSqlite3 from "better-sqlite3";
import { desc, eq } from "drizzle-orm";
import { BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema.js";
import { AssistantMessage, UserMessage } from "./schema.js";

/**
 * Service for interacting with the SQLite database for chat persistence
 */
export class DatabaseService {
  private db: BetterSQLite3Database<typeof schema>;
  private sqliteDb: BetterSqlite3.Database;
  private initialized = false;
  private dbPath: string;

  constructor() {
    // Create db directory in root if it doesn't exist
    const dbDir = path.join(process.cwd(), "db");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.dbPath = path.join(dbDir, "triage-chats.db");

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
      // Check if the database file exists and has tables
      const hasTables = this.checkIfTablesExist();

      if (hasTables) {
        this.initialized = true;
        return;
      }

      // Create tables using direct SQL statements
      this.createTables();

      this.initialized = true;
      console.info("DatabaseService: Tables created successfully");
    } catch (error) {
      console.error("Error creating database tables:", error);
      throw error;
    }
  }

  private checkIfTablesExist(): boolean {
    try {
      // Check if the chats table exists
      const result = this.sqliteDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chats'")
        .get();
      return !!result;
    } catch (error) {
      return false;
    }
  }

  private createTables(): void {
    // Use raw SQL to create tables
    this.sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS user_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        content TEXT NOT NULL,
        context_items TEXT,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS assistant_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        response TEXT NOT NULL,
        stages TEXT NOT NULL,
        error TEXT,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );
    `);
  }

  async createChat(): Promise<number> {
    console.info("DatabaseService: Creating new chat");
    try {
      const result = await this.db.insert(schema.chats).values({}).returning();

      if (!result.length) {
        throw new Error("Failed to create chat - no ID returned");
      }

      // TODO: do not use !
      console.info("DatabaseService: Created chat with ID:", result[0]!.id);
      return result[0]!.id;
    } catch (error) {
      console.error("Error creating chat:", error);
      throw error;
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
          contextItems: message.contextItems ? JSON.stringify(message.contextItems) : null,
        })
        .returning();

      if (!result.length) {
        throw new Error("Failed to save user message - no ID returned");
      }

      // TODO: do not use !
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
          stages: JSON.stringify(message.stages),
          error: message.error || null,
        })
        .returning();

      if (!result.length) {
        throw new Error("Failed to save assistant message - no ID returned");
      }

      // TODO: do not use !
      console.info("DatabaseService: Saved assistant message with ID:", result[0]!.id);
      return result[0]!.id;
    } catch (error) {
      console.error("Error saving assistant message:", error);
      throw error;
    }
  }

  async getChatMessages(chatId: number): Promise<any[]> {
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
          role: "user",
          timestamp: new Date(row.timestamp),
          content: row.content,
          contextItems: row.contextItems ? JSON.parse(row.contextItems) : undefined,
        })),
        ...assistantMessages.map((row: AssistantMessage) => ({
          id: row.id.toString(),
          role: "assistant",
          timestamp: new Date(row.timestamp),
          response: row.response,
          stages: JSON.parse(row.stages),
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

  async clearChat(chatId: number): Promise<void> {
    await this.db.delete(schema.chats).where(eq(schema.chats.id, chatId));
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
