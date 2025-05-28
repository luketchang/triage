import { ObservabilityClient } from "@triage/data-integrations";
import { LanguageModelV1 } from "ai";

import { UserMessage } from "../types/message";
import { DataSource } from "../types/tools";

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
  dataSources: DataSource[];
  abortSignal?: AbortSignal;
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
    await preProcessing.run();

    const reasoning = new Reasoning(this.config, this.state);
    await reasoning.run();

    const postProcessing = new PostProcessing(this.config, this.state);
    await postProcessing.run();

    return {
      answer: this.state.getAnswer()!,
      steps: this.state.getSteps(StepsType.CURRENT),
    };
  }
}
