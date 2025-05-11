import { logger } from "@triage/common";
import { v4 as uuidv4 } from "uuid";

import { CodeSearchAgent, CodeSearchAgentResponse } from "../nodes/code-search";
import { LogSearchAgent, LogSearchAgentResponse } from "../nodes/log-search";

import { PipelineStateManager } from "./state";

import { TriagePipelineConfig } from ".";

const INITIAL_LOG_REQUEST =
  "fetch logs relevant to the issue/event that will give you a full picture of the issue/event";

const INITIAL_CODE_REQUEST =
  "fetch code relevant to the issue/event that will give you a full picture of the issue/event";

export type PreProcessingResults = {
  logs: LogSearchAgentResponse;
  code: CodeSearchAgentResponse;
};

export class PreProcessing {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;
  private logSearch: LogSearchAgent;
  private codeSearch: CodeSearchAgent;

  constructor(config: Readonly<TriagePipelineConfig>, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
    this.logSearch = new LogSearchAgent(this.config, this.state);
    this.codeSearch = new CodeSearchAgent(this.config, this.state);
  }

  async run(): Promise<void> {
    // TODO: add code search and lazy return joined promise
    logger.info("\n\n" + "=".repeat(25) + " Log Search " + "=".repeat(25));
    const logSearchId = uuidv4();
    this.state.recordHighLevelStep("logSearch", logSearchId);
    await this.logSearch.invoke({
      logSearchId,
      logRequest: INITIAL_LOG_REQUEST,
    });

    logger.info("\n\n" + "=".repeat(25) + " Code Search " + "=".repeat(25));
    const codeSearchId = uuidv4();
    this.state.recordHighLevelStep("codeSearch", codeSearchId);
    await this.codeSearch.invoke({
      codeSearchId,
      codeRequest: INITIAL_CODE_REQUEST,
    });
  }
}
