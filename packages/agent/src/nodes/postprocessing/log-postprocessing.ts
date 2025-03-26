import { AnthropicModel, getModelWrapper, logger, OpenAIModel } from "@triage/common";
import { generateText } from "ai";
import {
  LogPostprocessing as LogPostprocessingResponse,
  logPostprocessingToolSchema,
} from "../../types";
import { formatLogResults, validateToolCalls } from "../utils";

function createPrompt(params: {
  query: string;
  codebaseOverview: string;
  labelsMap: string;
  logContext: Record<string, string>;
  answer: string;
}) {
  return `
  You are an expert AI assistant that assists engineers debugging production issues. You specifically review answers to user queries (about a potential issue/event) and gather supporting context from logs.
  
  Given the user query, the proposed answer/analysis, an overview of the codebase, log labels, and previously gathered log and code context, your task is cite relevant log queries within the <previous_log_context> tags that support the answer. Then you will output a summary of the log results in the form of a sequence of events. This context will be presented to the user in the form of a summary and a list of log queries and their results.

  Query/Result Selection Criteria:
  - Queries should be a broad view of logs that capture the issue/event.
  - Queries should not just show a single line (e.g. just the error trace) but should show a broader view of the logs / set of events.
  - Output at most 5 queries.

  Summary Format:
  - The summary should be a sequence of events presented as a numbered list.
  - Each list element should be a concise description of an event.

  <query>
  ${params.query}
  </query>

  <answer>
  ${params.answer}
  </answer>

  <codebase_overview>
  ${params.codebaseOverview}
  </codebase_overview>

  <labels_map>
  ${params.labelsMap}
  </labels_map>
  
  <previous_log_context>
  ${formatLogResults(params.logContext)}
  </previous_log_context>
  `;
}

export class LogPostprocessor {
  private llm: OpenAIModel | AnthropicModel;

  constructor(llm: OpenAIModel | AnthropicModel) {
    this.llm = llm;
  }

  async invoke(params: {
    query: string;
    codebaseOverview: string;
    labelsMap: string;
    logContext: Record<string, string>;
    answer: string;
  }): Promise<LogPostprocessingResponse> {
    logger.info(`Log postprocessing for query: ${params.query}`);

    const prompt = createPrompt(params);

    logger.info(`Log postprocessing prompt:\n${prompt}`);

    const { toolCalls } = await generateText({
      model: getModelWrapper(this.llm),
      prompt: prompt,
      tools: {
        logPostprocessing: logPostprocessingToolSchema,
      },
      toolChoice: "required",
    });

    const toolCall = validateToolCalls(toolCalls);

    const outputObj: LogPostprocessingResponse = {
      type: "logPostprocessing",
      relevantQueries: toolCall.args.relevantQueries,
      summary: toolCall.args.summary,
    };

    return outputObj;
  }
}
