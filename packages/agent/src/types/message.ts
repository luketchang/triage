import {
  LogSearchInput,
  LogsWithPagination,
  RetrieveSentryEventInput,
  SentryEvent,
} from "@triage/data-integrations";

import { AgentStep } from "../pipeline/state";

export interface AssistantMessage {
  role: "assistant";
  steps: AgentStep[];
  response: string | undefined;
  error: string | undefined;
}

// NOTE: we do not have | error types for output because we currently just discard the context item if we could not fetch its result so as to not confuse LLM with error in user message
export type MaterializedContextItem =
  | {
      type: "log";
      input: LogSearchInput;
      output: LogsWithPagination;
    }
  | {
      type: "sentry";
      input: RetrieveSentryEventInput;
      output: SentryEvent;
    };

export interface UserMessage {
  role: "user";
  content: string;
  contextItems?: MaterializedContextItem[];
}

export type ChatMessage = UserMessage | AssistantMessage;
