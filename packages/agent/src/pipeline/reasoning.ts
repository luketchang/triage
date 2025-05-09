import { logger } from "@triage/common";
import { LogsWithPagination } from "@triage/observability";
import { CoreMessage } from "ai";
import { v4 as uuidv4 } from "uuid";

import { LogSearchAgent } from "../nodes/log-search";
import { Reasoner } from "../nodes/reasoner";
import { LLMToolCall, Toolbox } from "../tools";
import { CatRequestResult } from "../tools/index";
import { LogSearchStep, ReasoningStep } from "../types";

import { PreProcessingResults } from "./pre-processing";

import { TriagePipelineConfig, TriagePipelineState } from ".";

export class Reasoning {
  private readonly config: TriagePipelineConfig;
  private state: TriagePipelineState;
  private reasoner: Reasoner;
  private toolbox: Toolbox;
  private llmChatHistory: CoreMessage[] = [];

  constructor(
    config: TriagePipelineConfig,
    state: TriagePipelineState,
    preProcessingResults: PreProcessingResults
  ) {
    this.config = config;
    this.state = state;
    this.reasoner = new Reasoner(this.config, preProcessingResults.logs, preProcessingResults.code);
    this.toolbox = new Toolbox(this.config.observabilityPlatform, new LogSearchAgent(this.config));
  }

  async run(): Promise<ReasoningStep> {
    logger.info("\n\n" + "=".repeat(25) + " Reasoning " + "=".repeat(25));

    const reasoningId = uuidv4();

    if (this.config.onUpdate) {
      this.config.onUpdate({ type: "highLevelUpdate", id: reasoningId, stepType: "reasoning" });
    }

    let iterationCount = 0;
    const maxIterations = 50;

    let lastReasoningResponse: ReasoningStep = {
      type: "reasoning",
      content: "Error in reasoning",
      timestamp: new Date(),
    };

    let toolCalls: LLMToolCall[] = [];

    do {
      for (const toolCall of toolCalls) {
        const result = await this.toolbox.invokeToolCall(toolCall);

        // TODO: do we even need this?
        switch (toolCall.type) {
          case "logSearchInput":
            this.state.logSearchSteps.push({
              timestamp: new Date(),
              input: {
                type: "logSearchInput",
                start: toolCall.start,
                end: toolCall.end,
                query: toolCall.query,
                limit: toolCall.limit,
                pageCursor: toolCall.pageCursor,
              },
              results: result as LogsWithPagination,
            } as LogSearchStep);
            break;
          case "catRequest":
            this.state.codeSearchSteps.push({
              type: "codeSearch",
              timestamp: new Date(),
              filepath: toolCall.path,
              source: (result as CatRequestResult).content,
            });
            break;
        }

        this.llmChatHistory.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.type,
              result: result,
              // TODO: detect errors and set isError
            },
          ],
        });

        // TODO: move this into toolbox
        if (this.config.onUpdate) {
          this.config.onUpdate({
            type: "intermediateUpdate",
            id: uuidv4(),
            parentId: reasoningId,
            step: {
              type: "reasoning",
              timestamp: new Date(),
              // TODO: more user friendly message with tool call details
              contentChunk: `Tool call ${toolCall.type} completed`,
            },
          });
        }
      }
      toolCalls = [];

      const reasoningResponse = await this.reasoner.invoke({
        llmChatHistory: this.llmChatHistory,
        parentId: reasoningId,
        maxSteps: maxIterations - iterationCount,
      });
      logger.info(`Reasoning response: ${JSON.stringify(reasoningResponse)}`);

      if (reasoningResponse.type === "toolCalls") {
        for (const toolCall of reasoningResponse.toolCalls) {
          toolCalls.push(toolCall);
        }
      } else {
        this.llmChatHistory.push({
          role: "assistant",
          content: reasoningResponse.content,
        });
        lastReasoningResponse = reasoningResponse;
      }
    } while (iterationCount++ < maxIterations && toolCalls.length > 0);

    return lastReasoningResponse;
  }

  getLlmChatHistory(): readonly CoreMessage[] {
    return this.llmChatHistory;
  }
}
