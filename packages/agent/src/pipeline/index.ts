import { logger } from "@triage/common";
import { ObservabilityClient } from "@triage/data-integrations";
import { LanguageModelV1 } from "ai";

import { UserMessage } from "../types/message";

import { PostProcessing } from "./post-processing";
import { PreProcessing } from "./pre-processing";
import { Reasoning } from "./reasoning";
import { AgentStep, StepsType } from "./state";
import { PipelineStateManager } from "./state-manager";

export type TriagePipelineConfig = {
  reasoningClient: LanguageModelV1;
  fastClient: LanguageModelV1;
  observabilityClient: ObservabilityClient;
  userMessage: UserMessage;
  timezone: string;
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  logLabelsMap: Map<string, string[]>;
};

export type TriagePipelineState = {
  stepManager: PipelineStateManager;
  answer?: string;
};

export type TriagePipelineResponse = {
  answer: string;
  steps: AgentStep[];
};

export class TriagePipeline {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;

  constructor(config: Readonly<TriagePipelineConfig>, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
  }

  async run(): Promise<TriagePipelineResponse> {
    // TODO -- skip pre-processing if we have results in chat history
    const preProcessing = new PreProcessing(this.config, this.state);
    logger.info("Running pre-processing");
    await preProcessing.run();
    logger.info("Pre-processing completed successfully");

    const reasoning = new Reasoning(this.config, this.state);
    logger.info("Running reasoning");
    await reasoning.run();
    logger.info("Reasoning completed successfully");

    const postProcessing = new PostProcessing(this.config, this.state);
    logger.info("Running post-processing");
    await postProcessing.run();
    logger.info("Post-processing completed successfully");

    return {
      answer: this.state.getAnswer()!,
      steps: this.state.getSteps(StepsType.CURRENT),
    };
  }
}
