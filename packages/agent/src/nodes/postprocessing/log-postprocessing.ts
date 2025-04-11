import { getModelWrapper, logger, Model } from "@triage/common";
import { LogsWithPagination } from "@triage/observability";
import { generateText } from "ai";
import stableStringify from "json-stable-stringify";
import {
  logPostprocessingToolSchema,
  LogSearchInputCore,
  PostprocessedLogSearchInput,
} from "../../types";
import { ensureSingleToolCall, formatFacetValues, formatLogResults } from "../utils";

function createPrompt(params: {
  query: string;
  codebaseOverview: string;
  logLabelsMap: Map<string, string[]>;
  logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
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

  Rules:
  - You must output a single log postprocessing tool call.
  
  <query>
  ${params.query}
  </query>

  <answer>
  ${params.answer}
  </answer>

  <codebase_overview>
  ${params.codebaseOverview}
  </codebase_overview>

  <log_labels>
  ${formatFacetValues(params.logLabelsMap)}
  </log_labels>
  
  <previous_log_context>
  ${formatLogResults(params.logContext)}
  </previous_log_context>
  `;
}

export class LogPostprocessor {
  private llm: Model;

  constructor(llm: Model) {
    this.llm = llm;
  }

  async invoke(params: {
    query: string;
    codebaseOverview: string;
    logLabelsMap: Map<string, string[]>;
    logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
    answer: string;
  }): Promise<Map<PostprocessedLogSearchInput, LogsWithPagination | string>> {
    const prompt = createPrompt(params);

    const { toolCalls } = await generateText({
      model: getModelWrapper(this.llm),
      prompt: prompt,
      tools: {
        logPostprocessing: logPostprocessingToolSchema,
      },
      toolChoice: "required",
    });

    const toolCall = ensureSingleToolCall(toolCalls);
    const relevantQueries = toolCall.args.relevantQueries || [];
    const typedRelevantQueries = relevantQueries.map((query) => ({
      ...query,
      type: "logSearchInput",
    })); // TODO: this is a bit hacky to tag type and strip title, has to be some better type system way to do it

    logger.info(`Found ${relevantQueries.length} relevant queries in postprocessing response`);

    const lookup = new Map(
      Array.from(params.logContext.entries()).map(([query, result]) => [
        stableStringify(query),
        { query, result },
      ])
    );

    // Create the final map by looking up each relevant query
    const relevantResultsMap = new Map<PostprocessedLogSearchInput, LogsWithPagination | string>();

    for (const relevantQuery of typedRelevantQueries) {
      const { title, summary, ...query } = relevantQuery; // TODO: also hacky to strip title here
      const stableKey = stableStringify(query);

      logger.info(`Looking for query with stable key: ${stableKey}`);
      const match = lookup.get(stableKey);

      if (match) {
        logger.info(`Found matching log query: ${stableKey}`);
        relevantResultsMap.set(relevantQuery, match.result);
      } else {
        logger.warn(`No match found for query: ${stableKey}`);
      }
    }

    logger.info(`Log postprocessing complete with ${relevantResultsMap.size} relevant log entries`);
    return relevantResultsMap;
  }
}
