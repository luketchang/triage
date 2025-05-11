import { logger } from "@triage/common";
import { v4 as uuidv4 } from "uuid";

import { CodePostprocessor } from "../nodes/code-postprocessing";
import { LogPostprocessor } from "../nodes/log-postprocessing";

import { PipelineStateManager } from "./state";

import { TriagePipelineConfig } from ".";

export class PostProcessing {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;

  constructor(config: Readonly<TriagePipelineConfig>, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
  }

  async run(): Promise<void> {
    // TODO: Run post processing steps in parallel
    logger.info("\n\n" + "=".repeat(25) + " Postprocess Logs " + "=".repeat(25));

    const logPostprocessingId = uuidv4();

    this.state.recordHighLevelStep("logPostprocessing", logPostprocessingId);
    const logPostprocessor = new LogPostprocessor(this.config, this.state);

    const logPostprocessingResponse = await logPostprocessor.invoke({
      parentId: logPostprocessingId,
    });

    logger.info(
      `Log postprocessing complete with ${logPostprocessingResponse.facts.length} relevant facts`
    );

    logger.info("\n\n" + "=".repeat(25) + " Postprocess Code " + "=".repeat(25));

    const codePostprocessingId = uuidv4();

    this.state.recordHighLevelStep("codePostprocessing", codePostprocessingId);

    const codePostprocessor = new CodePostprocessor(this.config, this.state);

    const codePostprocessingResponse = await codePostprocessor.invoke({
      parentId: codePostprocessingId,
    });

    logger.info(
      `Code postprocessing complete with ${codePostprocessingResponse.facts.length} relevant facts`
    );
  }
}
