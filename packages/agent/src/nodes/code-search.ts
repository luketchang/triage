import { collectSourceCode, timer } from "@triage/common";
import { LanguageModelV1 } from "ai";

import { AgentStreamUpdate, CatStep, CodeSearchStep } from "../pipeline/state";

export interface CodeSearchAgentResponse {
  newCodeSearchSteps: CodeSearchStep[];
}

// TODO: implement actual code search, not just dummy implementation
export class CodeSearchAgent {
  constructor(private readonly llmClient: LanguageModelV1) {}

  @timer
  async invoke(params: {
    query: string;
    codeRequest: string;
    repoPath: string;
    codeSearchId: string;
    codeSearchSteps: CatStep[];
    onUpdate?: (update: AgentStreamUpdate) => void;
  }): Promise<CodeSearchAgentResponse> {
    const codeMap = collectSourceCode(params.repoPath);
    const newCodeSearchSteps: CatStep[] = Array.from(codeMap.entries()).map(
      ([filepath, source]) => ({
        type: "cat",
        timestamp: new Date(),
        path: filepath,
        source,
      })
    );

    return {
      newCodeSearchSteps,
    };
  }
}
