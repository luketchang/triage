import { AgentAssistantMessage, AgentUserMessage, ChatMessage } from "../types/index.js";

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
      return { ...message, contextItems: message.materializedContextItems } as AgentUserMessage;
    } else {
      return { ...message } as AgentAssistantMessage;
    }
  });
}
