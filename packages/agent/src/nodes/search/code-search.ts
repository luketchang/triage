import { timer } from "@triage/common";
import { v4 as uuidv4 } from "uuid";

import { AgentStreamUpdate, CodeSearchStep } from "../..";

export interface CodeSearchAgentResponse {
  newCodeSearchSteps: CodeSearchStep[];
}

// TODO: implement actual code search, not just dummy implementation
export class CodeSearchAgent {
  @timer
  async invoke(params: {
    codeSearchId: string;
    codeSearchSteps: CodeSearchStep[];
    onUpdate?: (update: AgentStreamUpdate) => void;
  }): Promise<CodeSearchAgentResponse> {
    const newCodeSearchSteps: CodeSearchStep[] = [];

    for (const step of params.codeSearchSteps) {
      if (params.onUpdate) {
        params.onUpdate({
          type: "intermediateUpdate",
          id: uuidv4(),
          parentId: params.codeSearchId,
          step: step,
        });
      }
      newCodeSearchSteps.push(step);
    }

    return {
      newCodeSearchSteps,
    };
  }
}
