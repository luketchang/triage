import { LogsWithPagination } from "@triage/observability";
import { z, infer as zInfer } from "zod";

import { LLMToolCall, SubAgentCall } from "../tools";

const BASIC_REASONING_DESCRIPTION =
  "Intermediate reasoning where you can explain what you see from the given information and what information you need next (if any).";

const rereviewRequestSchema = z.object({
  reasoning: z.string().describe("Reasoning process behind your hypothesis."),
});

export const rereviewRequestToolSchema = {
  description: "Indicate that you need to re-review the root cause analysis with the same context",
  parameters: rereviewRequestSchema,
};

const taskCompleteSchema = z.object({
  reasoning: z.string().describe("Reasoning process behind your findings for the task."),
  summary: z.string().describe("Summary of your findings for the task. Be precise and sequential."),
});

export type TaskComplete = zInfer<typeof taskCompleteSchema> & { type: "taskComplete" };

export const taskCompleteToolSchema = {
  description: "Indicate that the task is complete",
  parameters: taskCompleteSchema,
};

export const codeRequestSchema = z.object({
  request: z
    .string()
    .describe(
      "A directive to search for/explore a specific area of code. This should be a specific request for service, module, package, etc."
    ),
  reasoning: z.string().describe(BASIC_REASONING_DESCRIPTION),
});

export type CodeRequest = zInfer<typeof codeRequestSchema> & { type: "codeRequest" };

export const codeRequestToolSchema = {
  description:
    "A directive to search for/explore a specific area of code. This should be a specific request for service, module, package, etc.",
  parameters: codeRequestSchema,
};

export const spanRequestSchema = z.object({
  request: z
    .string()
    .describe(
      "A directive to search for/explore a type of set of spans. This should be a specific request for spans related to specific events, services, etc."
    ),
  reasoning: z.string().describe(BASIC_REASONING_DESCRIPTION),
});

export type SpanRequest = zInfer<typeof spanRequestSchema> & { type: "spanRequest" };

export const spanRequestToolSchema = {
  description:
    "A directive to search for/explore a type of set of spans. This should be a specific request for spans related to specific events, services, etc.",
  parameters: spanRequestSchema,
};

export const logRequestSchema = z.object({
  request: z
    .string()
    .describe(
      "A directive to search for/explore specific logs. This should be a specific request for logs related to specific events, services, etc."
    ),
  reasoning: z.string().describe(BASIC_REASONING_DESCRIPTION),
});

export type LogRequest = zInfer<typeof logRequestSchema> & { type: "logRequest" };

export const logRequestToolSchema = {
  description:
    "A directive to search for/explore specific logs. This should be a specific request for logs related to specific events, services, etc.",
  parameters: logRequestSchema,
};

export interface ReasoningRequest {
  type: "reasoningRequest";
}

export interface ReviewRequest {
  type: "reviewRequest";
}

export interface LogPostprocessingRequest {
  type: "logPostprocessing";
}

export interface CodePostprocessingRequest {
  type: "codePostprocessing";
}

export type RequestToolCalls = {
  type: "toolCalls";
  toolCalls: Array<LLMToolCall>;
};

export type RequestSubAgentCalls = {
  type: "subAgentCalls";
  subAgentCalls: Array<SubAgentCall>;
};

export const rootCauseAnalysisSchema = z.object({
  rootCause: z
    .string()
    .describe(
      "A clear and concise root cause analysis. Be specific and actionable. Do not cite vague terms like 'synchronization issues' or 'performance issues'. This can be a long input."
    ),
});

export type RootCauseAnalysis = zInfer<typeof rootCauseAnalysisSchema> & {
  type: "rootCauseAnalysis";
};

export const rootCauseAnalysisToolSchema = {
  description: "Output a root cause analysis",
  parameters: rootCauseAnalysisSchema,
};

export const logSearchInputSchema = z.object({
  // NOTE: this is reasoning for the previous log search results
  reasoning: z
    .string()
    .describe(
      "Objectively outline what you observe in the most recent set of fetched logs as a sequential list of events (if there exist any log search results). If you notice anything unusual and want to investigate further, explain what you will investigate. If you did not find anything useful, describe how you will change your query for next time."
    ),
  start: z
    .string()
    .describe(
      "Start time in ISO 8601 format with timezone (e.g., '2025-03-19T04:10:00Z'). Be generous and give -15 minutes if user provided exact time."
    ),
  end: z
    .string()
    .describe(
      "End time in ISO 8601 format with timezone (e.g., '2025-03-19T04:40:00Z'). Be generous and give +15 minutes if user provided exact time."
    ),
  query: z.string().describe("Log search query in the observability platform query language"),
  limit: z.number().describe("Maximum number of logs to return, default to 500"),
  pageCursor: z
    .string()
    .nullable()
    .describe(
      "Cursor for pagination. This is only a feature for Datadog. Do not use this for other platforms. Always set to null when no cursor is needed."
    ),
});

export type LogSearchResult = LogsWithPagination & { type: "logSearchResult" };

// Full LogSearchInput type with reasoning - used when interfacing with LLMs
export type LogSearchInput = zInfer<typeof logSearchInputSchema> & { type: "logSearchInput" };

// LogSearchInputCore type without reasoning - used for storage in context maps
export type LogSearchInputCore = Omit<LogSearchInput, "reasoning">;

export const logSearchInputToolSchema = {
  description: "Input parameters for searching logs.",
  parameters: logSearchInputSchema,
};

export const spanSearchInputSchema = z.object({
  // NOTE: this is reasoning for the previous span search results
  reasoning: z
    .string()
    .describe(
      "Objectively outline what you observe in the most recent set of fetched spans as a sequential list of events. If you notice anything unusual and want to investigate further, explain what you will investigate. If you did not find anything useful, describe how you will change your query for next time. If you have enough context, explain why you are done with the current search."
    ),
  start: z
    .string()
    .describe(
      "Start time in ISO 8601 format with timezone (e.g., '2025-03-19T04:10:00Z'). Be generous and give +/- 15 minutes if user provided exact time."
    ),
  end: z
    .string()
    .describe(
      "End time in ISO 8601 format with timezone (e.g., '2025-03-19T04:40:00Z'). Be generous and give +/- 15 minutes if user provided exact time."
    ),
  query: z.string().describe("Span search query in the observability platform query language"),
  pageLimit: z.number().describe("Maximum number of spans to return, default to 500"),
  pageCursor: z
    .string()
    .nullable()
    .describe(
      "Cursor for pagination. This is only a feature for Datadog. Do not use this for other platforms. Always set to null when no cursor is needed."
    ),
});

export type SpanSearchInput = zInfer<typeof spanSearchInputSchema> & { type: "spanSearchInput" };

// SpanSearchInputCore type without reasoning - used for storage in context maps
export type SpanSearchInputCore = Omit<SpanSearchInput, "reasoning">;

export const spanSearchInputToolSchema = {
  description: "Input parameters for searching spans.",
  parameters: spanSearchInputSchema,
};

export const traceSearchInputSchema = z.object({
  start: z
    .string()
    .describe(
      "Start time in ISO 8601 format with timezone (e.g., '2025-03-19T04:10:00Z'). Be generous and give +/- 15 minutes if user provided exact time."
    ),
  end: z
    .string()
    .describe(
      "End time in ISO 8601 format with timezone (e.g., '2025-03-19T04:40:00Z'). Be generous and give +/- 15 minutes if user provided exact time."
    ),
  query: z.string().describe("Trace search query in the observability platform query language"),
  limit: z.number().describe("Maximum number of traces to return, default to 20"),
  pageCursor: z
    .string()
    .nullable()
    .describe(
      "Cursor for pagination. This is only a feature for Datadog. Do not use this for other platforms. Always set to null when no cursor is needed."
    ),
  reasoning: z
    .string()
    .describe(
      "Objectively outline what you observe in the traces as sequence of events formatted as a numbered list. For example: 1. user clicked X.\n 2. recommendations service provided Y.\n 3. User saw Z. Only after the first step, then enumerate what other services or areas of the traces you may want to explore next if you are missing context."
    ),
});

export type TraceSearchInput = zInfer<typeof traceSearchInputSchema> & { type: "traceSearchInput" };

// TraceSearchInputCore type without reasoning - used for storage in context maps
export type TraceSearchInputCore = Omit<TraceSearchInput, "reasoning">;

export const traceSearchInputToolSchema = {
  description: "Input parameters for searching traces.",
  parameters: traceSearchInputSchema,
};

const catRequestParametersSchema = z.object({
  path: z.string().describe("File path to read"),
});

export const catRequestSchema = {
  description: "Read a file and return the contents. Works exactly like cat in the terminal.",
  parameters: catRequestParametersSchema,
};

export type CatRequest = z.infer<typeof catRequestParametersSchema> & { type: "catRequest" };

export const multiCatRequestParametersSchema = z.object({
  paths: z
    .array(catRequestParametersSchema)
    .describe(
      "Array of file paths to read. Each file path will be read via the cat terminal command."
    ),
});

export type CatRequestResult = {
  type: "catRequestResult";
  content: string;
};

const grepRequestParametersSchema = z.object({
  pattern: z.string().describe("Regular expression pattern to search for"),
  file: z.string().describe("File or directory to search in"),
  flags: z
    .string()
    .describe(
      "One or more single-letter grep flags combined without spaces (e.g., 'rni' for -r -n -i). Do not include dashes (e.g., write 'rni', not '-rni' or '--rni')."
    ),
});

export const grepRequestSchema = {
  description:
    "Search for a pattern in a file or directory. Works exactly like grep in the terminal.",
  parameters: grepRequestParametersSchema,
};

export type GrepRequest = z.infer<typeof grepRequestParametersSchema> & { type: "grepRequest" };

export type GrepRequestResult = {
  type: "grepRequestResult";
  content: string;
};

// The intermediate type the LLM outputs, later used to augment original query
export const logPostprocessingFactOutputSchema = logSearchInputSchema
  .omit({
    reasoning: true,
    start: true,
    end: true,
    query: true,
  })
  .extend({
    title: z.string().describe("A concise title summarizing the fact"),
    fact: z
      .string()
      .describe(
        "A fact derived from the log search result that supports the answer and some context on why it is relevant."
      ),
    query: z.string().describe("The original log search query from the previous log context"),
    start: z.string().describe("The narrowed in start time in ISO 8601 format"),
    end: z.string().describe("The narrowed in end time in ISO 8601 format"),
    highlightKeywords: z
      .array(z.string())
      .describe(
        "Keywords to highlight logs that support the fact. The should match the content of the log lines that support the fact even if the keywords themselves are generic.  They are matchers on the right logs and should not be attributes filters."
      ),
  });

export type LogPostprocessingFactOutput = zInfer<typeof logPostprocessingFactOutputSchema>;

// The final type we actually return to UI
export const logPostprocessingFactSchema = logSearchInputSchema
  .omit({
    reasoning: true,
  })
  .extend({
    title: z.string().describe("A concise title summarizing the fact"),
    fact: z
      .string()
      .describe(
        "A fact derived from the log search result that supports the answer and some context on why it is relevant."
      ),
  });

export type LogPostprocessingFact = zInfer<typeof logPostprocessingFactSchema>;

export const logPostprocessingSchema = z.object({
  facts: z
    .array(logPostprocessingFactOutputSchema)
    .describe(
      "An array of facts along with the log query for citation. Note this returned type MUST BE an array containing one or more fact types. It should contain at most 8 facts."
    ),
});

export type LogPostprocessing = zInfer<typeof logPostprocessingSchema>;

export const logPostprocessingToolSchema = {
  description: "Postprocess log results.",
  parameters: logPostprocessingSchema,
};

export const codePostprocessingFactSchema = z.object({
  title: z.string().describe("A concise title summarizing the fact"),
  fact: z
    .string()
    .describe(
      "A fact derived from the code search result that supports the answer and some context on why it is relevant."
    ),
  filepath: z.string().describe("The relative file path of the code block that supports the fact"),
  startLine: z.number().describe("The start line of the code block that supports the fact"),
  endLine: z.number().describe("The end line of the code block that supports the fact"),
});

export type CodePostprocessingFact = zInfer<typeof codePostprocessingFactSchema>;
export const codePostprocessingSchema = z.object({
  facts: z
    .array(codePostprocessingFactSchema)
    .describe(
      "An array of facts along with the file path for citation. Note this returned type MUST BE an array containing one or more fact types. It should contain at most 8 facts."
    ),
});

export type CodePostprocessing = zInfer<typeof codePostprocessingSchema>;

export const codePostprocessingToolSchema = {
  description: "Postprocess code results.",
  parameters: codePostprocessingSchema,
};

export const reviewDecisionSchema = z.object({
  accepted: z
    .boolean()
    .describe("True if the root cause analysis provided is complete and accurate"),
  reasoning: z.string().describe("Reasoning behind your decision"),
});

export const reviewDecisionToolSchema = {
  description:
    "Used to memorialize a deecision on whether a root cause analysis was accurate or not.",
  parameters: reviewDecisionSchema,
};

// Generic function to strip reasoning from input objects for storage
export function stripReasoning<T extends { reasoning: string; type?: string }>(
  input: T
): Omit<T, "reasoning"> {
  const { reasoning, ...core } = input;
  return core;
}

export function normalizeForKey<T extends { type: string }>(input: T): Omit<T, "type"> {
  const { type, ...core } = input;
  return core;
}
