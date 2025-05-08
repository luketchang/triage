import { logger } from "@triage/common";
import { CoreMessage } from "ai";
import { v4 as uuidv4 } from "uuid";

import { Reviewer } from "../nodes/reviewer";

import { TriagePipelineConfig } from ".";

type ReviewResult = {
  accepted: boolean;
  reasoning: string;
};

export class Review {
  private readonly config: TriagePipelineConfig;

  constructor(config: TriagePipelineConfig) {
    this.config = config;
  }

  async run(llmChatHistory: readonly CoreMessage[], answer: string): Promise<ReviewResult> {
    logger.info("\n\n" + "=".repeat(25) + " Review " + "=".repeat(25));

    const reviewId = uuidv4();

    if (this.config.onUpdate) {
      this.config.onUpdate({ type: "highLevelUpdate", id: reviewId, stepType: "review" });
    }

    const reviewer = new Reviewer(this.config);
    const reviewResults = await reviewer.invoke({
      llmChatHistory,
      answer,
      parentId: reviewId,
    });

    if (this.config.onUpdate) {
      this.config.onUpdate({
        type: "intermediateUpdate",
        id: uuidv4(),
        parentId: reviewId,
        step: {
          type: "review",
          timestamp: new Date(),
          contentChunk: reviewResults.content,
        },
      });
    }

    return {
      accepted: reviewResults.accepted ?? false,
      reasoning: reviewResults.content,
    };
  }
}
