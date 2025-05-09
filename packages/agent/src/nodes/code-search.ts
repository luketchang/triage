import { collectSourceCode, timer } from "@triage/common";
import { LanguageModelV1 } from "ai";

import { AgentStreamUpdate, CodeSearchStep } from "../types";

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
