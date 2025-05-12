import { logger } from "@triage/common";
import { v4 as uuidv4 } from "uuid";

import { CodeSearchAgent } from "../nodes/code-search";
import { LogSearchAgent } from "../nodes/log-search";
import { Reasoner } from "../nodes/reasoner";
import { ReasoningStep } from "../pipeline/state";

import { PipelineStateManager } from "./state";

import { TriagePipelineConfig } from ".";

export class Reasoning {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;
  private reasoner: Reasoner;
  private logSearchAgent: LogSearchAgent;
  private codeSearchAgent: CodeSearchAgent;

  constructor(config: Readonly<TriagePipelineConfig>, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
    this.reasoner = new Reasoner(this.config, this.state);
    this.logSearchAgent = new LogSearchAgent(this.config, this.state);
    this.codeSearchAgent = new CodeSearchAgent(this.config, this.state);
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
      try {
        const reasoningResponse = await this.reasoner.invoke({
          parentId: reasoningId,
          maxSteps: maxIterations - iterationCount,
        });
        logger.info(`Reasoning response: ${JSON.stringify(reasoningResponse)}`);

        if (reasoningResponse.type === "subAgentCalls") {
          for (const subAgentCall of reasoningResponse.subAgentCalls) {
            if (subAgentCall.type === "logRequest") {
              await this.logSearchAgent.invoke({
                logSearchId: uuidv4(),
                logRequest: subAgentCall.request,
              });
            } else if (subAgentCall.type === "codeRequest") {
              await this.codeSearchAgent.invoke({
                codeSearchId: uuidv4(),
                codeRequest: subAgentCall.request,
              });
            } else {
              throw new Error(`Unknown tool call type`);
            }
          }
        } else {
          lastReasoningResponse = reasoningResponse;
          break;
        }
      } catch (error) {
        logger.error(`Error during reasoning: ${error}`);
        throw error;
      }
    }

    this.state.setAnswer(lastReasoningResponse.content);
  }
}
