// Define database schema types for Kysely
export interface Database {
  chats: ChatsTable;
  user_messages: UserMessagesTable;
  assistant_messages: AssistantMessagesTable;
}

export interface ChatsTable {
  id: number;
  created_at: string;
}

export interface UserMessagesTable {
  id: number;
  chat_id: number;
  timestamp: string;
  content: string;
  context_items: string | null;
}

export interface AssistantMessagesTable {
  id: number;
  chat_id: number;
  timestamp: string;
  response: string;
  stages: string;
  error: string | null;
}
