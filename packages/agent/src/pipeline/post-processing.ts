import { logger } from "@triage/common";
import { v4 as uuidv4 } from "uuid";

import { CodePostprocessor } from "../nodes/code-postprocessing";
import { LogPostprocessor } from "../nodes/log-postprocessing";

import { TriagePipelineConfig, TriagePipelineState } from ".";

export class PostProcessing {
  private readonly config: TriagePipelineConfig;
  private state: TriagePipelineState;

  constructor(config: TriagePipelineConfig, state: TriagePipelineState) {
    this.config = config;
    this.state = state;
  }

  async run(): Promise<void> {
    logger.info("\n\n" + "=".repeat(25) + " Postprocess Logs " + "=".repeat(25));

    const logPostprocessingId = uuidv4();

    if (this.config.onUpdate) {
      this.config.onUpdate({
        type: "highLevelUpdate",
        id: logPostprocessingId,
        stepType: "logPostprocessing",
      });
    }

    const logPostprocessor = new LogPostprocessor(
      this.config.fastModel,
      this.config.observabilityPlatform
    );

    const logPostprocessingResponse = await logPostprocessor.invoke({
      query: this.config.query,
      logLabelsMap: this.config.logLabelsMap,
      logSearchSteps: this.state.logSearchSteps,
      answer: this.state.answer ?? "",
      parentId: logPostprocessingId,
      onUpdate: this.config.onUpdate,
    });

    logger.info(
      `Log postprocessing complete with ${logPostprocessingResponse.facts.length} relevant facts`
    );

    logger.info("\n\n" + "=".repeat(25) + " Postprocess Code " + "=".repeat(25));

    const codePostprocessingId = uuidv4();

    if (this.config.onUpdate) {
      this.config.onUpdate({
        type: "highLevelUpdate",
        id: codePostprocessingId,
        stepType: "codePostprocessing",
      });
    }

    const codePostprocessor = new CodePostprocessor(this.config.fastModel);

    const codeSearchSteps = this.state.codeSearchSteps;
    const codePostprocessingResponse = await codePostprocessor.invoke({
      query: this.config.query,
      repoPath: this.config.repoPath,
      codebaseOverview: this.config.codebaseOverview,
      codeSearchSteps,
      answer: this.state.answer ?? "",
      parentId: codePostprocessingId,
      onUpdate: this.config.onUpdate,
    });

    logger.info(
      `Code postprocessing complete with ${codePostprocessingResponse.facts.length} relevant facts`
    );
  }
}
