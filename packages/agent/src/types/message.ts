import { AgentStep, AgentStreamingStep } from "./agent";

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

export type AgentStreamUpdate = HighLevelUpdate | IntermediateUpdate;

export type HighLevelUpdate = {
  type: "highLevelUpdate";
  stepType: AgentStep["type"];
  id: string;
};

export type IntermediateUpdate = {
  type: "intermediateUpdate";
  id: string;
  parentId: string;
  step: AgentStreamingStep;
};
