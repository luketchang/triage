import {
  AnthropicModel,
  formatCodeMap,
  getModelWrapper,
  logger,
  OpenAIModel,
} from "@triage/common";
import { generateText } from "ai";
import {
  CodePostprocessing as CodePostprocessingResponse,
  codePostprocessingToolSchema,
} from "../../types";
import { validateToolCalls } from "../utils";

function createPrompt(params: {
  query: string;
  codebaseOverview: string;
  codeContext: Record<string, string>;
  answer: string;
}) {
  return `
  You are an expert AI assistant that assists engineers debugging production issues. You specifically review answers to user queries (about a potential issue/event) and gather supporting context from code.
  
  Given the user query, the proposed answer/analysis, an overview of the codebase, and previously gathered code context, your task is cite relevant code file paths within the <previous_code_context> tags that support the answer. Then you will output a summary of the code files and how they contribute to the answer. This context will be presented to the user in the form of a summary and a list of code files and their results.

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
  private llm: OpenAIModel | AnthropicModel;

  constructor(llm: OpenAIModel | AnthropicModel) {
    this.llm = llm;
  }

  async invoke(params: {
    query: string;
    codebaseOverview: string;
    codeContext: Record<string, string>;
    answer: string;
  }): Promise<CodePostprocessingResponse> {
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

    const toolCall = validateToolCalls(toolCalls);

    const outputObj: CodePostprocessingResponse = {
      type: "codePostprocessing",
      relevantFilepaths: toolCall.args.relevantFilepaths,
      summary: toolCall.args.summary,
    };

    return outputObj;
  }
}
