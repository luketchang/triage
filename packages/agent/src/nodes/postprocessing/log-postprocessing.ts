import { getModelWrapper, logger, Model, timer } from "@triage/common";
import { LogsWithPagination } from "@triage/observability";
import { generateText } from "ai";

import { LogPostprocessing, logPostprocessingToolSchema, LogSearchInputCore } from "../../types";
import { ensureSingleToolCall, formatFacetValues, formatLogResults } from "../utils";

function createPrompt(params: {
  query: string;
  codebaseOverview: string;
  logLabelsMap: Map<string, string[]>;
  logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
  answer: string;
}): string {
  return `
  You are an expert AI assistant that assists engineers debugging production issues. You specifically review answers to user queries (about a potential issue/event) and gather supporting context from logs.
  
  Given the user query, the proposed answer/analysis, an overview of the codebase, log labels, and previously gathered log and code context, your task is to pull out key facts from the log data along with citations supporting the facts. Examples of key facts might include a specific error or warning occurring, a user taking a certain action, an influx of requests to a service, a sequence of events occurring related to the issue, etc. Citations consist of a log query that narrows down the log context to show just the specific fact being cited.

  Rules:
  - You must output a single log postprocessing tool call. DO NOT output multiple tool calls.

  Tips:
  - Look at the log search queries in the previous log context to pick out both relevant facts and the get a base for the log queries you will use to cite the facts.
  - The citations don't need to exactly match the log search queries in the previous log context. You can narrow the timestamps of the log queries to a very narrow range to get a more precise log result that supports the fact.
  
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

  @timer
  async invoke(params: {
    query: string;
    codebaseOverview: string;
    logLabelsMap: Map<string, string[]>;
    logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
    answer: string;
  }): Promise<LogPostprocessing> {
    const prompt = createPrompt(params);

    const { toolCalls } = await generateText({
      model: getModelWrapper(this.llm),
      prompt: prompt,
      tools: {
        logPostprocessing: logPostprocessingToolSchema,
      },
      toolChoice: "required",
    });

    // If multiple tool calls are returned (on accident), we will just merge them
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
