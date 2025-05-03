import { ChatMessage as AgentChatMessage, AgentStreamUpdate } from "@triage/agent";
import { AssistantMessage, ChatMessage, UserMessage } from "../types";

declare global {
  interface Window {
    env: {
      TRACES_ENABLED: boolean;
      USE_MOCK_API: boolean;
    };
    electronAPI: {
      invokeAgent: (
        query: string,
        chatHistory: AgentChatMessage[],
        options?: { reasonOnly?: boolean }
      ) => Promise<any>;
      onAgentUpdate: (callback: (update: AgentStreamUpdate) => void) => () => void;
      getAgentConfig: () => Promise<any>;
      updateAgentConfig: (newConfig: unknown) => Promise<any>;
      fetchLogs: (params: unknown) => Promise<any>;
      getLogsFacetValues: (start: string, end: string) => Promise<any>;
      fetchTraces: (params: unknown) => Promise<any>;
      getSpansFacetValues: (start: string, end: string) => Promise<any>;
      getFileTree: (repoPath: string) => Promise<any>;
      getFileContent: (repoPath: string, filePath: string) => Promise<any>;

      // Chat storage methods
      saveUserMessage: (message: UserMessage) => Promise<number | null>;
      saveAssistantMessage: (message: AssistantMessage) => Promise<number | null>;
      loadChatMessages: () => Promise<ChatMessage[]>;
      clearChat: () => Promise<boolean>;
    };
  }
}

export {};
