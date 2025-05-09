import { logger } from "@triage/common";
import { ObservabilityPlatform } from "@triage/observability";
import { LanguageModelV1 } from "ai";

import { AgentStreamUpdate, CodeSearchStep, LogSearchStep } from "../types";

import { PostProcessing } from "./post-processing";
import { PreProcessing } from "./pre-processing";
import { Reasoning } from "./reasoning";
import { Review } from "./review";

export type TriagePipelineConfig = {
  reasoningClient: LanguageModelV1;
  fastClient: LanguageModelV1;
  observabilityPlatform: ObservabilityPlatform;
  query: string;
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  logLabelsMap: Map<string, string[]>;
  onUpdate?: (update: AgentStreamUpdate) => void;
};

export type TriagePipelineState = {
  logSearchSteps: LogSearchStep[];
  codeSearchSteps: CodeSearchStep[];
  answer?: string;
};

export type TriagePipelineResponse = {
  answer: string;
};

export class TriagePipeline {
  private config: TriagePipelineConfig;
  private state: TriagePipelineState = {
    logSearchSteps: [],
    codeSearchSteps: [],
    answer: undefined,
  };

  constructor(config: TriagePipelineConfig) {
    this.config = config;
  }

  async run(): Promise<TriagePipelineResponse> {
    const maxReviewRejections = 3;

    // TODO -- skip pre-processing if we have results in chat history
    const preProcessing = new PreProcessing(this.config, this.state);
    const preProcessingResults = await preProcessing.run();

    let isAccepted = false;
    let reviewRejections = 0;
    let latestAnswer = "";
    const reasoning = new Reasoning(this.config, this.state, preProcessingResults);
    while (!isAccepted && reviewRejections < maxReviewRejections) {
      const reasoningResults = await reasoning.run();
      logger.info(`Reasoning results: ${reasoningResults.content}`);
      const review = new Review(this.config);
      latestAnswer = reasoningResults.content;
      const reviewResults = await review.run(reasoning.getLlmChatHistory(), latestAnswer);
      logger.info(`Review results: ${reviewResults.accepted}`);
      isAccepted = reviewResults.accepted;
      reviewRejections++;
    }

    if (reviewRejections >= maxReviewRejections) {
      logger.warning("We did not pass review after %d attempts", maxReviewRejections);
    }

    this.state.answer = latestAnswer;

    const postProcessing = new PostProcessing(this.config, this.state);
    await postProcessing.run();

    return {
      answer: latestAnswer,
    };
  }
}
