import { getModelWrapper, logger, Model, timer } from "@triage/common";
import { ObservabilityPlatform } from "@triage/observability";
import { generateId, generateText } from "ai";

import { AgentStreamUpdate, LogPostprocessingFact, LogPostprocessingStep, logPostprocessingToolSchema, LogSearchStep } from "../types";

import {
  ensureSingleToolCall,
  formatFacetValues,
  formatLogSearchSteps,
  normalizeDatadogQueryString,
} from "./utils";

const SYSTEM_PROMPT = `
You are an expert AI assistant that assists engineers debugging production issues. You specifically review answers to user queries (about a potential issue/event) and gather supporting context from logs.
`;

function createPrompt(params: {
  query: string;
  logLabelsMap: Map<string, string[]>;
  logSearchSteps: LogSearchStep[];
  platformSpecificInstructions: string;
  answer: string;
}): string {
  return `
  Given the user query, the proposed answer/analysis, an overview of the codebase, log labels, and previously gathered log and code context, your task is to pull out key facts from the log data along with citations supporting the facts. Examples of key facts might include a specific error or warning occurring, a user taking a certain action, an influx of requests to a service, a sequence of events occurring related to the issue across multiple services, etc. Citations consist of a log query that zooms in on the log context just enough such that the whole fact is understandable/supported.

  Rules:
  - A log postprocessing tool call will specify a list of facts. Each fact will have a fact description, a query copied from the previous log context section, a new narrowed time range, and a list of keywords from the log line content that are highlighted in the log search query to support the fact.
  - The new time range should zoom in on the most relevant set of logs to support the fact.
  - The list of highlighted keywords should have strings with log line content that is in the logs that support the fact. Note that the keywords themselves may be generic. They only serve to highlight the _logs_ that support the fact in the context of the issue, who's attributes may actually be specific to the fact and issue.
    - Example: The fact highlights that "ticket1" had its expiration acknowledged. The highlight keyword is just a matcher on the log line content for the right log even though the attributes tell you the full story.
      - Log: [2025-05-02T02:20:22.098Z] INFO [orders] Expiration complete event acknowledged [attributes: data={"orderId":"68142be32a9e4d001970b8e4","price":100,"id":"68142bb37df7bb001968b3f0","title":"ticket1","userId":"68142baa2efd310019a49d48","version":1}, level="info", service="orders", timestamp="2025-05-02T02:20:22.098Z"]
      - Fact: order expiration for "ticket1" was acknowledged
      - Highlight keywords: "Expiration complete event acknowledged"

  - You must output a single log postprocessing tool call. A postprocessing tool call may list multiple facts. DO NOT output multiple tool calls.

  Tips:
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
      system: SYSTEM_PROMPT,
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

    // Augment original query with highlight keywords
    const augmentedFacts: LogPostprocessingFact[] = normalizedFacts.map((fact) => ({
      title: fact.title,
      fact: fact.fact,
      query: this.observabilityPlatform.addKeywordsToQuery(fact.query, fact.highlightKeywords),
      start: fact.start,
      end: fact.end,
      limit: fact.limit,
      pageCursor: fact.pageCursor,
    }));

    if (params.onUpdate) {
      params.onUpdate({
        type: "intermediateUpdate",
        step: {
          type: "logPostprocessing",
          facts: augmentedFacts,
          timestamp: new Date(),
        },
        id: generateId(),
        parentId: params.parentId,
      });
    }

    return {
      type: "logPostprocessing",
      timestamp: new Date(),
      facts: augmentedFacts,
    };
  }
}
