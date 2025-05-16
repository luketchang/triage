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
    const logPostprocessor = new LogPostprocessor(this.config, this.state);
    const codePostprocessor = new CodePostprocessor(this.config, this.state);

    const [logPostprocessingResponse, codePostprocessingResponse] = await Promise.all([
      logPostprocessor.invoke(),
      codePostprocessor.invoke(),
    ]);

    logger.info(
      `Log postprocessing complete with ${logPostprocessingResponse.facts.length} relevant facts. Code postprocessing complete with ${codePostprocessingResponse.facts.length} relevant facts.`
    );
  }
}
