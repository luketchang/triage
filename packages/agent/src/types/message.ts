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
  response: string | null;
  error: string | null;
}

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
