import { CoreMessage } from "ai";

import { ChatMessage } from "../types/message";
import { formatAgentSteps, formatCatToolCalls, formatLogSearchToolCalls } from "../utils";

import {
  AgentStep,
  CatToolCall,
  GrepToolCall,
  LogSearchToolCall,
  StepsType,
  StreamUpdateFn,
} from "./state";

export class PipelineStateManager {
  private onUpdate: StreamUpdateFn;
  private chatHistory: ChatMessage[] = [];
  private currSteps: AgentStep[] = [];
  private answer?: string;

  constructor(onUpdate: StreamUpdateFn, chatHistory: ChatMessage[]) {
    this.onUpdate = onUpdate;
    this.chatHistory = chatHistory;
  }

  addStreamingStep(type: "reasoning", id: string, chunk: string): void {
    this.onUpdate({
      type: "intermediateUpdate",
      step: {
        id,
        type,
        chunk,
        timestamp: new Date(),
      },
    });
  }

  addIntermediateStep(step: AgentStep): void {
    this.currSteps.push(step);

    // NOTE: for reasoning steps, we don't want to send them to the stream since they are accumulated in chunks already. We just add them to agent local steps.
    if (step.type !== "reasoning") {
      this.onUpdate({
        type: "intermediateUpdate",
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

    const logContextToolCalls = this.getLogSearchToolCalls(StepsType.CURRENT);
    const codeContextToolCalls = this.getCatToolCalls(StepsType.CURRENT);
    return [
      {
        role: "system",
        content: systemPrompt,
      },
      ...chatHistory,
      {
        role: "assistant",
        content: `<log_context>\n${formatLogSearchToolCalls(logContextToolCalls)}\n</log_context>\n\n<code_context>\n${formatCatToolCalls(codeContextToolCalls)}\n</code_context>`,
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

  getLogSearchToolCalls(type: StepsType): LogSearchToolCall[] {
    return this.getSteps(type)
      .filter((step) => step.type === "logSearch")
      .flatMap((step) => step.data);
  }

  getCatToolCalls(type: StepsType): CatToolCall[] {
    return this.getSteps(type)
      .filter((step) => step.type === "codeSearch")
      .flatMap((step) => step.data)
      .filter((data) => data.type === "cat");
  }

  getGrepToolCalls(type: StepsType): GrepToolCall[] {
    return this.getSteps(type)
      .filter((step) => step.type === "codeSearch")
      .flatMap((step) => step.data)
      .filter((data) => data.type === "grep");
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
