import type { LogsWithPagination } from "@triage/observability";
import { CoreMessage, ToolResultPart } from "ai";
import { v4 as uuidv4 } from "uuid";

import { LLMToolCall, LLMToolCallResultOrError } from "../tools";
import { ChatMessage } from "../types/message";
import {
  CatRequest,
  CodePostprocessingFact,
  GrepRequest,
  LogPostprocessingFact,
  LogSearchInputCore,
} from "../types/tools";

export interface BaseAgentStep {
  timestamp: Date;
}

export interface LogSearchPair {
  input: LogSearchInputCore;
  results: LogsWithPagination | string;
}

export interface LogSearchStep extends BaseAgentStep, LogSearchPair {
  type: "logSearch";
}

export interface CatStep extends BaseAgentStep, Omit<CatRequest, "type"> {
  type: "cat";
  source: string;
}

export interface GrepStep extends BaseAgentStep, Omit<GrepRequest, "type"> {
  type: "grep";
  output: string;
}

export type CodeSearchStep = CatStep | GrepStep;

export interface ReasoningStep extends BaseAgentStep {
  type: "reasoning";
  content: string;
}

export interface ReviewStep extends BaseAgentStep {
  type: "review";
  content: string;
  accepted?: boolean;
}

export interface LogPostprocessingStep extends BaseAgentStep {
  type: "logPostprocessing";
  facts: LogPostprocessingFact[];
}

export interface CodePostprocessingStep extends BaseAgentStep {
  type: "codePostprocessing";
  facts: CodePostprocessingFact[];
}

export interface ToolCallStep extends BaseAgentStep {
  type: "toolCall";
  toolCall: LLMToolCall;
  result: LLMToolCallResultOrError;
}

export type AgentStep =
  | LogSearchStep
  | CatStep
  | GrepStep
  | ReasoningStep
  | ReviewStep
  | LogPostprocessingStep
  | CodePostprocessingStep
  | ToolCallStep;

type StreamingPartial<T> = Omit<T, "content"> & { contentChunk: string };

export type AgentStreamingStep =
  | LogSearchStep
  | CatStep
  | GrepStep
  | StreamingPartial<ReasoningStep>
  | StreamingPartial<ReviewStep>
  | LogPostprocessingStep
  | CodePostprocessingStep
  | ToolCallStep;

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

export type StreamUpdateFn = (update: AgentStreamUpdate) => void;

export class PipelineStateManager {
  private steps: AgentStep[] = [];
  private onUpdate: StreamUpdateFn;
  private reasonerChatHistory: CoreMessage[] = [];
  private answer?: string;

  constructor(onUpdate: StreamUpdateFn) {
    this.onUpdate = onUpdate;
  }

  initChatHistory(chatHistory: ChatMessage[]): void {
    for (const message of chatHistory) {
      if (message.role === "assistant") {
        for (const step of message.steps) {
          this.steps.push(step);
        }
      }
    }
  }

  recordHighLevelStep(stepType: AgentStep["type"], id?: string): void {
    this.onUpdate({
      type: "highLevelUpdate",
      stepType: stepType,
      id: id || uuidv4(),
    });
  }

  addStreamingStep(type: "reasoning" | "review", contentChunk: string, parentId: string): void {
    this.onUpdate({
      type: "intermediateUpdate",
      id: uuidv4(),
      parentId,
      step: {
        type,
        contentChunk,
        timestamp: new Date(),
      },
    });
  }

  addIntermediateStep(step: AgentStep, parentId: string): void {
    if (step.type === "reasoning" || step.type === "review") {
      throw new Error("Reasoning and review steps are handled in addStreamingReasoningStep");
    }
    this.steps.push(step);
    this.onUpdate({
      type: "intermediateUpdate",
      id: uuidv4(),
      parentId,
      step: step,
    });
  }

  recordToolCall(toolCall: LLMToolCall, result: LLMToolCallResultOrError, parentId: string): void {
    const step: ToolCallStep = {
      type: "toolCall",
      toolCall,
      result,
      timestamp: new Date(),
    };
    this.steps.push(step);
    this.onUpdate({
      type: "intermediateUpdate",
      id: uuidv4(),
      parentId,
      step,
    });
    let toolResult: ToolResultPart = {
      type: "tool-result",
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.type,
      result: "",
    };
    if ("error" in result) {
      toolResult.isError = true;
      toolResult.result = result.error;
    } else {
      toolResult.result = result;
    }
    this.reasonerChatHistory.push({
      role: "tool",
      content: [toolResult],
    });
  }

  recordReasonerAssistantMessage(content: string): void {
    const step: ReasoningStep = {
      type: "reasoning",
      content,
      timestamp: new Date(),
    };
    this.steps.push(step);
    this.reasonerChatHistory.push({
      role: "assistant",
      content,
    });
  }

  addReasonerChatMessage(message: CoreMessage): void {
    this.reasonerChatHistory.push(message);
  }

  setAnswer(answer: string): void {
    this.answer = answer;
  }

  getSteps(): AgentStep[] {
    return this.steps;
  }

  getLogSearchSteps(): LogSearchStep[] {
    return this.steps.filter((step) => step.type === "logSearch");
  }

  getCatSteps(): CatStep[] {
    return this.steps.filter((step) => step.type === "cat");
  }

  getGrepSteps(): GrepStep[] {
    return this.steps.filter((step) => step.type === "grep");
  }

  getReasonerChatHistory(): CoreMessage[] {
    return this.reasonerChatHistory;
  }

  getAnswer(): string | undefined {
    return this.answer;
  }
}
