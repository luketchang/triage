import { logger } from "@triage/common";
import { v4 as uuidv4 } from "uuid";

import { CodeSearchAgentResponse } from "../nodes/code-search";
import { LogSearchAgent, LogSearchAgentResponse } from "../nodes/log-search";
import { LogRequest } from "../types";

import { PipelineStateManager } from "./state";

import { TriagePipelineConfig } from ".";

const INITIAL_LOG_REQUEST: LogRequest = {
  type: "logRequest",
  request:
    "fetch logs relevant to the issue/event that will give you a full picture of the issue/event",
  reasoning: "",
};

export type PreProcessingResults = {
  logs: LogSearchAgentResponse;
  code: CodeSearchAgentResponse;
};

export class PreProcessing {
  private readonly config: TriagePipelineConfig;
  private state: PipelineStateManager;
  private logSearch: LogSearchAgent;
  // private codeSearch: CodeSearchAgent;

  constructor(config: TriagePipelineConfig, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
    this.logSearch = new LogSearchAgent(this.config, this.state);
    // this.codeSearch = new CodeSearchAgent(this.config.fastModel);
  }

  async run(): Promise<void> {
    // TODO: add code search and lazy return joined promise
    logger.info("\n\n" + "=".repeat(25) + " Log Search " + "=".repeat(25));
    const logSearchId = uuidv4();
    this.state.recordHighLevelStep("logSearch", logSearchId);
    await this.logSearch.invoke({
      logSearchId,
      logRequest: INITIAL_LOG_REQUEST.request,
    });
  }
}
