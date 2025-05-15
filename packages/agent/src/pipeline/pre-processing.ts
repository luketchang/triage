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
    await this.logSearch.invoke({
      logRequest: INITIAL_LOG_REQUEST,
    });

    await this.codeSearch.invoke({
      codeRequest: INITIAL_CODE_REQUEST,
    });
  }
}
