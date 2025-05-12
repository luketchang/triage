import type { LogsWithPagination } from "@triage/observability";
import { CoreMessage, ToolResultPart } from "ai";
import { v4 as uuidv4 } from "uuid";

import { formatCatSteps, formatLogSearchSteps } from "../nodes/utils";
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

export type AgentStage =
  | "logSearch"
  | "codeSearch"
  | "reasoning"
  | "review"
  | "logPostprocessing"
  | "codePostprocessing";

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
  stage: AgentStage;
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
    this.reasonerChatHistory = [];
    
    // If we have chat history, initialize reasonerChatHistory for multi-turn chat
    if (chatHistory.length > 0) {
      // Go through user/assistant message pairs to build proper chat history
      for (const message of chatHistory) {
        // Process user messages
        if (message.role === "user") {
          // Add user message to chat history
          this.reasonerChatHistory.push({
            role: "user",
            content: message.content,
          });
        } else if (message.role === "assistant") {
          // Get all steps from this assistant message
          const logSteps = message.steps.filter(
            (step): step is LogSearchStep => step.type === "logSearch"
          );
          const catSteps = message.steps.filter((step): step is CatStep => step.type === "cat");
          console.info("Num cat steps: ", catSteps.length);
          console.info("Cat steps: ", JSON.stringify(catSteps));

          // Add log context as an assistant message (if any)
          if (logSteps.length > 0) {
            this.reasonerChatHistory.push({
              role: "assistant",
              content: `<log_context>\n${formatLogSearchSteps(logSteps)}\n</log_context>`,
            });
          }

          // Add code context as an assistant message (if any)
          if (catSteps.length > 0) {
            console.info("PUSHING CAT STEPS TO HISTORY", catSteps.length);
            this.reasonerChatHistory.push({
              role: "assistant",
              content: `<code_context>\n${formatCatSteps(catSteps)}\n</code_context>`,
            });
          }

          // Add the final assistant response
          if (message.response) {
            this.reasonerChatHistory.push({
              role: "assistant",
              content: message.response,
            });
          }
        }
      }
    }
  }

  recordHighLevelStep(stage: AgentStage, id?: string): void {
    this.onUpdate({
      type: "highLevelUpdate",
      stage,
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
      step,
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
