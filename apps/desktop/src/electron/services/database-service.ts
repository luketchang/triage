import BetterSqlite3 from "better-sqlite3";
import { app } from "electron";
import { Kysely, SqliteDialect, sql } from "kysely";
import path from "path";
import {
  AgentStage,
  AssistantMessage,
  ChatMessage,
  ContextItem,
  UserMessage,
} from "../../renderer/types";
import { Database } from "../db/schema";

export class DatabaseService {
  private db: Kysely<Database>;
  private sqliteDb: BetterSqlite3.Database;
  private initialized = false;

  constructor() {
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "triage-chats.db");

    try {
      // Create and store the SQLite database instance
      this.sqliteDb = new BetterSqlite3(dbPath, {
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
    } catch (error) {
      console.error("Error creating database tables:", error);
      throw error;
    }
  }

  async createChat(): Promise<number> {
    const result = await this.db
      .insertInto("chats")
      .defaultValues()
      .returning("id")
      .executeTakeFirstOrThrow();

    return result.id;
  }

  async saveUserMessage(message: UserMessage, chatId: number): Promise<number> {
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

    return result.id;
  }

  async saveAssistantMessage(message: AssistantMessage, chatId: number): Promise<number> {
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

    return result.id;
  }

  async getChatMessages(chatId: number): Promise<ChatMessage[]> {
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

    const messages: ChatMessage[] = [
      ...userMessages.map((row) => ({
        id: row.id.toString(),
        role: "user" as const,
        timestamp: new Date(row.timestamp),
        content: row.content,
        contextItems: row.context_items
          ? (JSON.parse(row.context_items) as ContextItem[])
          : undefined,
      })),
      ...assistantMessages.map((row) => ({
        id: row.id.toString(),
        role: "assistant" as const,
        timestamp: new Date(row.timestamp),
        response: row.response,
        stages: JSON.parse(row.stages) as AgentStage[],
        error: row.error || undefined,
      })),
    ];

    // Sort by timestamp
    return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getLatestChatId(): Promise<number | null> {
    const result = await this.db
      .selectFrom("chats")
      .select("id")
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();

    return result?.id || null;
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
}
