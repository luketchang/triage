import { logger } from "@triage/common";
import { v4 as uuidv4 } from "uuid";

import { Reviewer } from "../nodes/reviewer";

import { PipelineStateManager } from "./state";

import { TriagePipelineConfig } from ".";

type ReviewResult = {
  accepted: boolean;
  reasoning: string;
};

export class Review {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;

  constructor(config: Readonly<TriagePipelineConfig>, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
  }

  async run(): Promise<ReviewResult> {
    logger.info("\n\n" + "=".repeat(25) + " Review " + "=".repeat(25));

    const reviewId = uuidv4();

    this.state.recordHighLevelStep("review", reviewId);

    const reviewer = new Reviewer(this.config, this.state);
    const reviewResults = await reviewer.invoke({ parentId: reviewId });

    return {
      accepted: reviewResults.accepted ?? false,
      reasoning: reviewResults.content,
    };
  }
}
