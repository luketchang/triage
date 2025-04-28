import { formatCodeMap, getModelWrapper, logger, Model, timer } from "@triage/common";
import { generateText } from "ai";

import { CodePostprocessing, codePostprocessingToolSchema } from "../../types";
import { ensureSingleToolCall } from "../utils";

function createPrompt(params: {
  query: string;
  codebaseOverview: string;
  codeContext: Map<string, string>;
  answer: string;
}): string {
  return `
  You are an expert AI assistant that assists engineers debugging production issues. You specifically review answers to user queries (about a potential issue/event) and gather supporting context from code.
  
  Given the user query, the proposed answer/analysis, an overview of the codebase, and previously gathered code context, your task is to pull out key/relevant facts from the code context that support the answer along with citations for the facts. Examples of key facts might include a specific region of code that has a bug, a code section that is related to the issue, etc. Citations consist of a block of code and the file path for that code block.

  Rules:
  - You must output a single code postprocessing tool call. DO NOT output multiple tool calls.

  <query>
  ${params.query}
  </query>

  <answer>
  ${params.answer}
  </answer>

  <codebase_overview>
  ${params.codebaseOverview}
  </codebase_overview>
  
  <previous_code_context>
  ${formatCodeMap(params.codeContext)}
  </previous_code_context>
  `;
}

export class CodePostprocessor {
  private llm: Model;

  constructor(llm: Model) {
    this.llm = llm;
  }

  @timer
  async invoke(params: {
    query: string;
    codebaseOverview: string;
    codeContext: Map<string, string>;
    answer: string;
  }): Promise<CodePostprocessing> {
    logger.info(`Code postprocessing for query: ${params.query}`);

    const prompt = createPrompt(params);

    const { toolCalls } = await generateText({
      model: getModelWrapper(this.llm),
      prompt: prompt,
      tools: {
        codePostprocessing: codePostprocessingToolSchema,
      },
      toolChoice: "required",
    });

    let toolCall;
    if (toolCalls.length > 1) {
      logger.warn("Multiple tool calls detected, merging results");
      toolCall = {
        args: {
          facts: toolCalls.flatMap((call) => call.args.facts || []),
        },
      };
    } else {
      toolCall = ensureSingleToolCall(toolCalls);
    }

    return {
      facts: toolCall.args.facts || [],
    };
  }
}
