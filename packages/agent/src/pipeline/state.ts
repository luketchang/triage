import type { LogsWithPagination } from "@triage/observability";
import { CoreMessage } from "ai";
import { v4 as uuidv4 } from "uuid";

import { formatAgentSteps, formatCatSteps, formatLogSearchSteps } from "../nodes/utils";
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
  | LogPostprocessingStep
  | CodePostprocessingStep
  | ToolCallStep;

export type AgentStage =
  | "logSearch"
  | "codeSearch"
  | "reasoning"
  | "logPostprocessing"
  | "codePostprocessing";

type StreamingPartial<T> = Omit<T, "content"> & { contentChunk: string };

export type AgentStreamingStep =
  | LogSearchStep
  | CatStep
  | GrepStep
  | StreamingPartial<ReasoningStep>
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

export enum StepsType {
  CURRENT = "current",
  PREVIOUS = "previous",
  BOTH = "both",
}

export class PipelineStateManager {
  private onUpdate: StreamUpdateFn;
  private chatHistory: ChatMessage[] = [];
  private currSteps: AgentStep[] = [];
  private answer?: string;

  constructor(onUpdate: StreamUpdateFn, chatHistory: ChatMessage[]) {
    this.onUpdate = onUpdate;
    this.chatHistory = chatHistory;
  }

  recordHighLevelStep(stage: AgentStage, id?: string): void {
    this.onUpdate({
      type: "highLevelUpdate",
      stage,
      id: id || uuidv4(),
    });
  }

  addStreamingStep(type: "reasoning", contentChunk: string, parentId: string): void {
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
    this.currSteps.push(step);

    // NOTE: for reasoning steps, we don't want to send them to the stream since they are accumulated in chunks already. We just add them to agent local steps.
    if (step.type !== "reasoning") {
      this.onUpdate({
        type: "intermediateUpdate",
        id: uuidv4(),
        parentId,
        step,
      });
    }
  }

  chatHistoryAsCoreMessages(): CoreMessage[] {
    const coreMessages: CoreMessage[] = [];
    for (const message of this.chatHistory) {
      if (message.role === "user") {
        coreMessages.push({
          role: "user",
          content: message.content,
        });
      } else {
        // For assistant messages, create a content string that includes gathered context and response
        let content = "";

        // Add gathered context if there are steps
        if (message.steps && message.steps.length > 0) {
          content += `Gathered Context:\n${formatAgentSteps(message.steps)}`;
        }

        // Add response if it exists
        if (message.response) {
          // If we already have content, add a newline before the response
          if (content) {
            content += "\n\n";
          }
          content += `Response: ${message.response}`;
        }

        // Add error if it exists
        if (message.error) {
          // If we already have content, add a newline before the error
          if (content) {
            content += "\n\n";
          }
          content += `Error: ${message.error}`;
        }

        // Only push if there's content to push
        if (content) {
          coreMessages.push({
            role: "assistant",
            content,
          });
        }
      }
    }
    return coreMessages;
  }

  getReasonerMessages(systemPrompt: string): CoreMessage[] {
    const chatHistory = this.chatHistoryAsCoreMessages();
    console.info("Chat history reasoner: ", JSON.stringify(chatHistory));

    const logContextSteps = this.getLogSearchSteps(StepsType.CURRENT);
    const codeContextSteps = this.getCatSteps(StepsType.CURRENT);
    return [
      {
        role: "system",
        content: systemPrompt,
      },
      ...chatHistory,
      {
        role: "assistant",
        content: `<log_context>\n${formatLogSearchSteps(logContextSteps)}\n</log_context>\n\n<code_context>\n${formatCatSteps(codeContextSteps)}\n</code_context>`,
      },
    ];
  }

  getSteps(type: StepsType): AgentStep[] {
    switch (type) {
      case StepsType.CURRENT:
        return this.currSteps;
      case StepsType.PREVIOUS:
        return this.chatHistory
          .filter((message) => message.role === "assistant")
          .flatMap((message) => message.steps || [])
          .filter((step) => step !== undefined);
      case StepsType.BOTH:
        return [
          ...this.chatHistory
            .filter((message) => message.role === "assistant")
            .flatMap((message) => message.steps || [])
            .filter((step) => step !== undefined),
          ...this.currSteps,
        ];
    }
  }

  getLogSearchSteps(type: StepsType): LogSearchStep[] {
    return this.getSteps(type).filter((step) => step.type === "logSearch");
  }

  getCatSteps(type: StepsType): CatStep[] {
    return this.getSteps(type).filter((step) => step.type === "cat");
  }

  getGrepSteps(type: StepsType): GrepStep[] {
    return this.getSteps(type).filter((step) => step.type === "grep");
  }

  getChatHistory(): ChatMessage[] {
    return this.chatHistory;
  }

  setAnswer(answer: string): void {
    this.answer = answer;
  }

  getAnswer(): string | undefined {
    return this.answer;
  }
}
