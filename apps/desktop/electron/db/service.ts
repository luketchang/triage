import BetterSqlite3 from "better-sqlite3";
import fs from "fs";
import { Kysely, SqliteDialect, sql } from "kysely";
import path from "path";
import { Database } from "./interfaces.js";

/**
 * Service for interacting with the SQLite database for chat persistence
 */
export class DatabaseService {
  private db: Kysely<Database>;
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

    console.log("DatabaseService: Initializing with database path:", this.dbPath);
    console.log("Current working directory:", process.cwd());

    try {
      // Create and store the SQLite database instance
      this.sqliteDb = new BetterSqlite3(this.dbPath, {
        verbose: process.env.NODE_ENV === "development" ? console.log : undefined,
      });

      // Set pragmas directly on the SQLite instance
      this.sqliteDb.pragma("foreign_keys = ON");
      this.sqliteDb.pragma("journal_mode = WAL");

      // Create the Kysely instance with the SQLite dialect
      const dialect = new SqliteDialect({
        database: this.sqliteDb,
      });

      this.db = new Kysely<Database>({ dialect });
      this.initialize();
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create tables if they don't exist
      await this.db.schema
        .createTable("chats")
        .ifNotExists()
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("created_at", "text", (col) =>
          // Use a simpler approach for default timestamp
          col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
        )
        .execute();

      await this.db.schema
        .createTable("user_messages")
        .ifNotExists()
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("chat_id", "integer", (col) =>
          col.notNull().references("chats.id").onDelete("cascade")
        )
        .addColumn("timestamp", "text", (col) => col.notNull())
        .addColumn("content", "text", (col) => col.notNull())
        .addColumn("context_items", "text")
        .execute();

      await this.db.schema
        .createTable("assistant_messages")
        .ifNotExists()
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("chat_id", "integer", (col) =>
          col.notNull().references("chats.id").onDelete("cascade")
        )
        .addColumn("timestamp", "text", (col) => col.notNull())
        .addColumn("response", "text", (col) => col.notNull())
        .addColumn("stages", "text", (col) => col.notNull())
        .addColumn("error", "text")
        .execute();

      this.initialized = true;
      console.log("DatabaseService: Tables created successfully");
    } catch (error) {
      console.error("Error creating database tables:", error);
      throw error;
    }
  }

  async createChat(): Promise<number> {
    console.log("DatabaseService: Creating new chat");
    try {
      const result = await this.db
        .insertInto("chats")
        .defaultValues()
        .returning("id")
        .executeTakeFirstOrThrow();

      console.log("DatabaseService: Created chat with ID:", result.id);
      return result.id;
    } catch (error) {
      console.error("Error creating chat:", error);
      throw error;
    }
  }

  async getLatestChatId(): Promise<number | null> {
    try {
      const result = await this.db
        .selectFrom("chats")
        .select("id")
        .orderBy("id", "desc")
        .limit(1)
        .executeTakeFirst();

      console.log("DatabaseService: Latest chat ID:", result?.id || "none");
      return result?.id || null;
    } catch (error) {
      console.error("Error getting latest chat ID:", error);
      return null;
    }
  }

  async saveUserMessage(message: any, chatId: number): Promise<number> {
    console.log("DatabaseService: Saving user message for chat ID:", chatId);
    try {
      const result = await this.db
        .insertInto("user_messages")
        .values({
          chat_id: chatId,
          timestamp: message.timestamp.toISOString(),
          content: message.content,
          context_items: message.contextItems ? JSON.stringify(message.contextItems) : null,
        } as any)
        .returning("id")
        .executeTakeFirstOrThrow();

      console.log("DatabaseService: Saved user message with ID:", result.id);
      return result.id;
    } catch (error) {
      console.error("Error saving user message:", error);
      throw error;
    }
  }

  async saveAssistantMessage(message: any, chatId: number): Promise<number> {
    console.log("DatabaseService: Saving assistant message for chat ID:", chatId);
    try {
      const result = await this.db
        .insertInto("assistant_messages")
        .values({
          chat_id: chatId,
          timestamp: message.timestamp.toISOString(),
          response: message.response,
          stages: JSON.stringify(message.stages),
          error: message.error || null,
        } as any)
        .returning("id")
        .executeTakeFirstOrThrow();

      console.log("DatabaseService: Saved assistant message with ID:", result.id);
      return result.id;
    } catch (error) {
      console.error("Error saving assistant message:", error);
      throw error;
    }
  }

  async getChatMessages(chatId: number): Promise<any[]> {
    const userMessages = await this.db
      .selectFrom("user_messages")
      .select(["id", "timestamp", "content", "context_items"])
      .where("chat_id", "=", chatId)
      .execute();

    const assistantMessages = await this.db
      .selectFrom("assistant_messages")
      .select(["id", "timestamp", "response", "stages", "error"])
      .where("chat_id", "=", chatId)
      .execute();

    const messages = [
      ...userMessages.map((row) => ({
        id: row.id.toString(),
        role: "user",
        timestamp: new Date(row.timestamp),
        content: row.content,
        contextItems: row.context_items ? JSON.parse(row.context_items) : undefined,
      })),
      ...assistantMessages.map((row) => ({
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
  }

  async clearChat(chatId: number): Promise<void> {
    await this.db.deleteFrom("chats").where("id", "=", chatId).execute();
  }

  async destroy(): Promise<void> {
    try {
      await this.db.destroy();
      if (this.sqliteDb) {
        this.sqliteDb.close();
      }
    } catch (error) {
      console.error("Error destroying database connection:", error);
    }
  }

  async getDatabaseStats(): Promise<{
    dbPath: string;
    chatsCount: number;
    userMessagesCount: number;
    assistantMessagesCount: number;
  }> {
    try {
      const chatsCount = await this.db
        .selectFrom("chats")
        .select(sql`count(*)`.as("count"))
        .executeTakeFirstOrThrow();

      const userMessagesCount = await this.db
        .selectFrom("user_messages")
        .select(sql`count(*)`.as("count"))
        .executeTakeFirstOrThrow();

      const assistantMessagesCount = await this.db
        .selectFrom("assistant_messages")
        .select(sql`count(*)`.as("count"))
        .executeTakeFirstOrThrow();

      return {
        dbPath: this.dbPath,
        chatsCount: Number(chatsCount.count),
        userMessagesCount: Number(userMessagesCount.count),
        assistantMessagesCount: Number(assistantMessagesCount.count),
      };
    } catch (error) {
      console.error("Error getting database stats:", error);
      return {
        dbPath: this.dbPath,
        chatsCount: -1,
        userMessagesCount: -1,
        assistantMessagesCount: -1,
      };
    }
  }
}
