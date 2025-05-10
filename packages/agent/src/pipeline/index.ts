import { logger } from "@triage/common";
import { ObservabilityPlatform } from "@triage/observability";
import { LanguageModelV1 } from "ai";

import { PostProcessing } from "./post-processing";
import { PreProcessing } from "./pre-processing";
import { Reasoning } from "./reasoning";
import { Review } from "./review";
import { AgentStep, PipelineStateManager } from "./state";

export type TriagePipelineConfig = {
  reasoningClient: LanguageModelV1;
  fastClient: LanguageModelV1;
  observabilityPlatform: ObservabilityPlatform;
  query: string;
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
    const maxReviewRejections = 3;

    // TODO -- skip pre-processing if we have results in chat history
    const preProcessing = new PreProcessing(this.config, this.state);
    await preProcessing.run();

    let isAccepted = false;
    let reviewRejections = 0;
    const reasoning = new Reasoning(this.config, this.state);
    while (!isAccepted && reviewRejections < maxReviewRejections) {
      await reasoning.run();
      logger.info(`Reasoning results: ${this.state.getAnswer()}`);
      const review = new Review(this.config, this.state);
      const reviewResults = await review.run();
      logger.info(`Review results: ${reviewResults.accepted}`);
      isAccepted = reviewResults.accepted;
      reviewRejections++;
    }

    if (reviewRejections >= maxReviewRejections) {
      logger.warning("We did not pass review after %d attempts", maxReviewRejections);
    }

    const postProcessing = new PostProcessing(this.config, this.state);
    await postProcessing.run();

    return {
      answer: this.state.getAnswer()!,
      steps: this.state.getSteps(),
    };
  }
}
