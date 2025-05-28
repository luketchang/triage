import { logger } from "@triage/common";

import { CodePostprocessor } from "../nodes/code-postprocessing";
import { LogPostprocessor } from "../nodes/log-postprocessing";

import { PipelineStateManager } from "./state-manager";

import { TriagePipelineConfig } from ".";

export class PostProcessing {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;

  constructor(config: Readonly<TriagePipelineConfig>, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
  }

  async run(): Promise<void> {
    const tasks = this.config.dataSources.map(async (source) => {
      if (source === "logs") {
        const response = await new LogPostprocessor(this.config, this.state).invoke();
        logger.info(`Log postprocessing complete with ${response.data.length} relevant facts`);
      } else if (source === "code") {
        const response = await new CodePostprocessor(this.config, this.state).invoke();
        logger.info(`Code postprocessing complete with ${response.data.length} relevant facts`);
      }
    });

    await Promise.all(tasks);
  }
}
