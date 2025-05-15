import { logger } from "@triage/common";

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
    const logPostprocessor = new LogPostprocessor(this.config, this.state);

    const logPostprocessingResponse = await logPostprocessor.invoke();

    logger.info(
      `Log postprocessing complete with ${logPostprocessingResponse.facts.length} relevant facts`
    );

    const codePostprocessor = new CodePostprocessor(this.config, this.state);

    const codePostprocessingResponse = await codePostprocessor.invoke();

    logger.info(
      `Code postprocessing complete with ${codePostprocessingResponse.facts.length} relevant facts`
    );
  }
}
