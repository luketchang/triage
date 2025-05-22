import { LogSearchInput, LogsWithPagination, TraceSearchInput } from "@triage/data-integrations";
import { z, infer as zInfer } from "zod";

import { SubAgentCall } from "../tools";

const BASIC_REASONING_DESCRIPTION =
  "Intermediate reasoning where you can explain what you see from the given information and what information you need next (if any).";

// Task complete types
const taskCompleteSchema = z.object({
  reasoning: z.string().describe("Reasoning process behind your findings for the task."),
  summary: z.string().describe("Summary of your findings for the task. Be precise and sequential."),
});

export type TaskComplete = zInfer<typeof taskCompleteSchema> & { type: "taskComplete" };

export const taskCompleteToolSchema = {
  description: "Indicate that the task is complete",
  parameters: taskCompleteSchema,
};

// Code request types
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

// Log request types
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

// Subagent call types
export type RequestSubAgentCalls = {
  type: "subAgentCalls";
  subAgentCalls: Array<SubAgentCall>;
};

// Log search types
export const logSearchInputSchema = z.object({
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
  query: z.string().describe("Log search query in the observability client query language"),
  limit: z.number().describe("Maximum number of logs to return, default to 500"),
  pageCursor: z
    .string()
    .optional()
    .describe(
      "Cursor for pagination. This is only a feature for Datadog. Do not use this for other observability clients. Always set to null when no cursor is needed."
    ),
});

export type LogSearchRequest = LogSearchInput;

export const logSearchInputToolSchema = {
  description: "Input parameters for searching logs.",
  parameters: logSearchInputSchema,
};

export type LogSearchResult = LogsWithPagination & {
  type: "result";
  toolCallType: "logSearchInput";
};

// Trace search types
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
  query: z.string().describe("Trace search query in the observability client query language"),
  limit: z.number().describe("Maximum number of traces to return, default to 20"),
  pageCursor: z
    .string()
    .optional()
    .describe(
      "Cursor for pagination. This is only a feature for Datadog. Do not use this for other observability clients. Always set to null when no cursor is needed."
    ),
  reasoning: z
    .string()
    .describe(
      "Objectively outline what you observe in the traces as sequence of events formatted as a numbered list. For example: 1. user clicked X.\n 2. recommendations service provided Y.\n 3. User saw Z. Only after the first step, then enumerate what other services or areas of the traces you may want to explore next if you are missing context."
    ),
});

export const traceSearchInputToolSchema = {
  description: "Input parameters for searching traces.",
  parameters: traceSearchInputSchema,
};

export type TraceSearchRequest = TraceSearchInput;

// Cat types
const catRequestSchema = z.object({
  path: z.string().describe("Absolute file path to read"),
});

export const catRequestToolSchema = {
  description: "Read a file and return the contents. Works exactly like cat in the terminal.",
  parameters: catRequestSchema,
};

export type CatRequest = z.infer<typeof catRequestSchema> & { type: "catRequest" };

export type CatRequestResult = {
  type: "result";
  toolCallType: "catRequest";
  content: string;
};

// Grep types
const grepRequestSchema = z.object({
  pattern: z.string().describe("Regular expression pattern to search for"),
  flags: z
    .string()
    .describe(
      "One or more single-letter git-grep flags combined without spaces (e.g., 'rni' for -r -n -i). Do not include dashes (e.g., write 'rni', not '-rni' or '--rni')."
    ),
});

export const grepRequestToolSchema = {
  description:
    "git-grep: Look for specified patterns in the tracked files in the work tree, blobs registered in the index file, or blobs in given tree objects. Patterns are lists of one or more search expressions separated by newline characters. An empty string as search expression matches all lines.",
  parameters: grepRequestSchema,
};

export type GrepRequest = z.infer<typeof grepRequestSchema> & { type: "grepRequest" };

export type GrepRequestResult = {
  type: "result";
  toolCallType: "grepRequest";
  content: string;
};

// Combined code search input
export type CodeSearchInput = CatRequest | GrepRequest;

// Log postprocessing types
export const logPostprocessingFactOutputSchema = logSearchInputSchema
  .omit({
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

// The final type we actually return to UI
export const logPostprocessingFactSchema = logSearchInputSchema.extend({
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

// Code postprocessing types
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
