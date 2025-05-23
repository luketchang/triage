import {
  AgentAssistantMessage,
  AgentUserMessage,
  ChatMessage,
  UserMessage,
} from "../types/index.js";

/**
 * Converts a desktop ChatMessage to an agent UserMessage
 *
 * @param message A desktop ChatMessage
 * @returns An agent UserMessage
 */
export function convertToAgentUserMessage(message: UserMessage): AgentUserMessage {
  return {
    role: "user",
    content: message.content,
    contextItems: message.materializedContextItems,
  };
}

/**
 * Converts an array of desktop ChatMessage objects to an array of agent ChatMessage objects
 *
 * @param messages Array of desktop ChatMessage objects
 * @returns Array of agent ChatMessage objects
 */
export function convertToAgentChatMessages(
  messages: ChatMessage[]
): Array<AgentUserMessage | AgentAssistantMessage> {
  return messages.map((message) => {
    if (message.role === "user") {
      return convertToAgentUserMessage(message);
    } else {
      return {
        role: "assistant",
        steps: message.steps,
        response: message.response,
        error: message.error,
      };
    }
  });
}
