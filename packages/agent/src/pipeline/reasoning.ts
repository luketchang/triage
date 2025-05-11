import { logger } from "@triage/common";
import { v4 as uuidv4 } from "uuid";

import { LogSearchAgent } from "../nodes/log-search";
import { Reasoner } from "../nodes/reasoner";
import { ReasoningStep } from "../pipeline/state";
import { Toolbox } from "../tools";

import { PipelineStateManager } from "./state";

import { TriagePipelineConfig } from ".";

export class Reasoning {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;
  private reasoner: Reasoner;
  private logSearchAgent: LogSearchAgent;
  private toolbox: Toolbox;

  constructor(config: Readonly<TriagePipelineConfig>, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
    this.reasoner = new Reasoner(this.config, this.state);
    this.logSearchAgent = new LogSearchAgent(this.config, this.state);
    this.toolbox = new Toolbox(this.config.observabilityPlatform);
  }

  async run(): Promise<void> {
    logger.info("\n\n" + "=".repeat(25) + " Reasoning " + "=".repeat(25));

    const reasoningId = uuidv4();

    this.state.recordHighLevelStep("reasoning", reasoningId);

    let iterationCount = 0;
    const maxIterations = 50;

    let lastReasoningResponse: ReasoningStep = {
      type: "reasoning",
      content: "Error in reasoning",
      timestamp: new Date(),
    };

    while (iterationCount++ < maxIterations) {
      const reasoningResponse = await this.reasoner.invoke({
        parentId: reasoningId,
        maxSteps: maxIterations - iterationCount,
      });
      logger.info(`Reasoning response: ${JSON.stringify(reasoningResponse)}`);

      if (reasoningResponse.type === "toolCalls") {
        for (const toolCall of reasoningResponse.toolCalls) {
          if (toolCall.type === "logRequest") {
            const result = await this.logSearchAgent.invoke({
              logSearchId: uuidv4(),
              logRequest: toolCall.request,
            });
            this.state.recordToolCall(toolCall, result, reasoningId);
          } else {
            const result = await this.toolbox.invokeToolCall(toolCall);
            this.state.recordToolCall(toolCall, result, reasoningId);
          }
        }
      } else {
        this.state.recordReasonerAssistantMessage(reasoningResponse.content);
        lastReasoningResponse = reasoningResponse;
        break;
      }
    }

    this.state.setAnswer(lastReasoningResponse.content);
  }
}
