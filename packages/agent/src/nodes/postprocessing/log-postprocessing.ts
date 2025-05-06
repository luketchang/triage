import { getModelWrapper, logger, Model, timer } from "@triage/common";
import { generateId, generateText } from "ai";

import { ObservabilityPlatform } from "@triage/observability";
import { AgentStreamUpdate, LogPostprocessingStep, LogSearchStep } from "../../types";
import { logPostprocessingToolSchema } from "../../types/tools";
import {
  ensureSingleToolCall,
  formatFacetValues,
  formatLogSearchSteps,
  normalizeDatadogQueryString,
} from "../utils";

function createPrompt(params: {
  query: string;
  logLabelsMap: Map<string, string[]>;
  logSearchSteps: LogSearchStep[];
  platformSpecificInstructions: string;
  answer: string;
}): string {
  return `
  You are an expert AI assistant that assists engineers debugging production issues. You specifically review answers to user queries (about a potential issue/event) and gather supporting context from logs.
  
  Given the user query, the proposed answer/analysis, an overview of the codebase, log labels, and previously gathered log and code context, your task is to pull out key facts from the log data along with citations supporting the facts. Examples of key facts might include a specific error or warning occurring, a user taking a certain action, an influx of requests to a service, a sequence of events occurring related to the issue across multiple services, etc. Citations consist of a log query that zooms in on the log context just enough such that the whole fact is understandable/supported.

  Rules:
  - You must output a single log postprocessing tool call. DO NOT output multiple tool calls.

  Tips:
  - Use the log search queries in the previous log context section as a starting place for formatting your own log search queries. Your queries should be the exact same as the previous log search queries EXCEPT they can make two types of modifications:
    - You may edit the time range parameters to zoom in on the most relevant set of logs
    - You may add additional message-content-only filters (i.e. not attributes filters, but just keywords in the log message content). These filters should only be additive (e.g. | or OR clauses) and should not reduce the result set of the original query.
  - Bias towards using queries that include multiple services. We want to see full sequence of events across the relevant services not just a single service isolated.
  - DO NOT change anything about the search parameters except for the time range and the additive message-content-only filters.
  - Strictly follow the platform specific instructions provided below for guidance on the DOs and DONTs of writing log search queries.
  
  <query>
  ${params.query}
  </query>

  <answer>
  ${params.answer}
  </answer>

  <log_labels>
  ${formatFacetValues(params.logLabelsMap)}
  </log_labels>

  <platform_specific_instructions>
  ${params.platformSpecificInstructions}
  </platform_specific_instructions>
    
  <previous_log_context>
  ${formatLogSearchSteps(params.logSearchSteps)}
  </previous_log_context>
  `;
}

export class LogPostprocessor {
  private llm: Model;
  private observabilityPlatform: ObservabilityPlatform;

  constructor(llm: Model, observabilityPlatform: ObservabilityPlatform) {
    this.llm = llm;
    this.observabilityPlatform = observabilityPlatform;
  }

  @timer
  async invoke(params: {
    query: string;
    logLabelsMap: Map<string, string[]>;
    logSearchSteps: LogSearchStep[];
    answer: string;
    parentId: string;
    onUpdate?: (update: AgentStreamUpdate) => void;
  }): Promise<LogPostprocessingStep> {
    const prompt = createPrompt({
      ...params,
      platformSpecificInstructions: this.observabilityPlatform.getLogSearchQueryInstructions(),
    });

    logger.info(`Log postprocessing prompt:\n${prompt}`);

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

    // Normalize Datadog query strings in each fact
    const normalizedFacts =
      toolCall.args.facts?.map((fact) => ({
        ...fact,
        query: normalizeDatadogQueryString(fact.query),
      })) || [];

    if (params.onUpdate) {
      params.onUpdate({
        type: "intermediateUpdate",
        step: {
          type: "logPostprocessing",
          facts: normalizedFacts,
          timestamp: new Date(),
        },
        id: generateId(),
        parentId: params.parentId,
      });
    }

    return {
      type: "logPostprocessing",
      timestamp: new Date(),
      facts: normalizedFacts,
    };
  }
}
