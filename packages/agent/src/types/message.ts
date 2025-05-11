import { AgentStep } from "../pipeline/state";

export interface AssistantMessage {
  role: "assistant";
  steps: AgentStep[];
  response: string | null;
  error: string | null;
}

export interface UserMessage {
  role: "user";
  content: string;
}

export type ChatMessage = UserMessage | AssistantMessage;
