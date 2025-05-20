import { InferInsertModel, InferSelectModel, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Define the schema using Drizzle's type-safe builders
export const chats = sqliteTable("chats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const userMessages = sqliteTable("user_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: integer("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  timestamp: text("timestamp").notNull(),
  content: text("content").notNull(),
  contextItems: text("context_items"),
});

export const assistantMessages = sqliteTable("assistant_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: integer("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  timestamp: text("timestamp").notNull(),
  response: text("response").notNull(),
  steps: text("steps").notNull(),
  error: text("error"),
});

// Define types from schema for use in the application
export type Chat = InferSelectModel<typeof chats>;
export type NewChat = InferInsertModel<typeof chats>;

export type UserMessage = InferSelectModel<typeof userMessages>;
export type NewUserMessage = InferInsertModel<typeof userMessages>;

export type AssistantMessage = InferSelectModel<typeof assistantMessages>;
export type NewAssistantMessage = InferInsertModel<typeof assistantMessages>;

// Export schema for migrations
export const schema = { chats, userMessages, assistantMessages };
