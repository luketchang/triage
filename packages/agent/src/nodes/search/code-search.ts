import { collectSourceCode, Model, timer } from "@triage/common";

import { AgentStreamUpdate, CodeSearchStep } from "../..";

export interface CodeSearchAgentResponse {
  newCodeSearchSteps: CodeSearchStep[];
}

// TODO: implement actual code search, not just dummy implementation
export class CodeSearchAgent {
  constructor(private readonly fastModel: Model) {
    this.fastModel = fastModel;
  }

  @timer
  async invoke(params: {
    query: string;
    codeRequest: string;
    repoPath: string;
    codeSearchId: string;
    codeSearchSteps: CodeSearchStep[];
    onUpdate?: (update: AgentStreamUpdate) => void;
  }): Promise<CodeSearchAgentResponse> {
    const codeMap = collectSourceCode(params.repoPath);
    const newCodeSearchSteps: CodeSearchStep[] = Array.from(codeMap.entries()).map(
      ([filepath, source]) => ({
        type: "codeSearch",
        timestamp: new Date(),
        filepath,
        source,
      })
    );

    return {
      newCodeSearchSteps,
    };
  }
}
