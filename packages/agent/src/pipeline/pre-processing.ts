import { logger } from "@triage/common";
import { v4 as uuidv4 } from "uuid";

import { CodeSearchAgent, CodeSearchAgentResponse } from "../nodes/code-search";
import { LogSearchAgent, LogSearchAgentResponse } from "../nodes/log-search";
import { LogRequest } from "../types";

import { TriagePipelineConfig, TriagePipelineState } from ".";

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
  private state: TriagePipelineState;
  private logSearch: LogSearchAgent;
  private codeSearch: CodeSearchAgent;

  constructor(config: TriagePipelineConfig, state: TriagePipelineState) {
    this.config = config;
    this.state = state;
    this.logSearch = new LogSearchAgent(this.config.fastModel, this.config);
    this.codeSearch = new CodeSearchAgent(this.config.fastModel);
  }

  async run(): Promise<PreProcessingResults> {
    // TODO: lazy return joined promise
    logger.info("\n\n" + "=".repeat(25) + " Log Search " + "=".repeat(25));
    const logSearchId = uuidv4();
    if (this.config.onUpdate) {
      this.config.onUpdate({ type: "highLevelUpdate", id: logSearchId, stepType: "logSearch" });
    }
    const logs = await this.logSearch.invoke({
      logSearchId,
      query: this.config.query,
      logRequest: INITIAL_LOG_REQUEST.request,
      logLabelsMap: this.config.logLabelsMap,
      logSearchSteps: this.state.logSearchSteps,
      codebaseOverview: this.config.codebaseOverview,
    });
    this.state.logSearchSteps = [...this.state.logSearchSteps, ...logs.newLogSearchSteps];

    return {
      logs,
      code: {
        // TODO: re-introduce code search
        newCodeSearchSteps: [],
      },
    };
  }
}
