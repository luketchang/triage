import { z, infer as zInfer } from "zod";
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
  toolCalls: Array<
    | SpanRequest
    | LogRequest
    | ReasoningRequest
    | ReviewRequest
    | LogPostprocessingRequest
    | CodePostprocessingRequest
  >;
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
  query: z.string().describe("Log search query in the observability platform query language"),
  limit: z.number().describe("Maximum number of logs to return, default to 500"),
  pageCursor: z
    .string()
    .nullable()
    .describe(
      "Cursor for pagination. This is only a feature for Datadog. Do not use this for other platforms. Always set to null when no cursor is needed."
    ),
  reasoning: z
    .string()
    .describe(
      "Objectively outline what you observe in the logs as sequence of events formatted as a numbered list. For example: 1. user clicked X.\n 2. recommendations service provided Y.\n 3. User saw Z. Only after the first step, then enumerate what other services or areas of the logs you may want to explore next if you are missing context."
    ),
});

// Full LogSearchInput type with reasoning - used when interfacing with LLMs
export type LogSearchInput = zInfer<typeof logSearchInputSchema> & { type: "logSearchInput" };

// LogSearchInputCore type without reasoning - used for storage in context maps
export type LogSearchInputCore = Omit<LogSearchInput, "reasoning">;

// Generic function to strip reasoning from input objects for storage
export function stripReasoning<T extends { reasoning: string; type?: string }>(
  input: T
): Omit<T, "reasoning"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { reasoning, ...core } = input;
  return core;
}

export function normalizeForKey<T extends { type: string }>(input: T): Omit<T, "type"> {
  const { type, ...core } = input;
  return core;
}

export const logSearchInputToolSchema = {
  description: "Input parameters for searching logs.",
  parameters: logSearchInputSchema,
};

export const spanSearchInputSchema = z.object({
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
  reasoning: z
    .string()
    .describe(
      "Objectively outline what you observe in the spans as sequence of events formatted as a numbered list. For example: 1. user clicked X.\n 2. recommendations service provided Y.\n 3. User saw Z. Only after the first step, then enumerate what other services or areas of the spans you may want to explore next if you are missing context."
    ),
});

export type SpanSearchInput = zInfer<typeof spanSearchInputSchema> & { type: "spanSearchInput" };

// SpanSearchInputCore type without reasoning - used for storage in context maps
export type SpanSearchInputCore = Omit<SpanSearchInput, "reasoning">;

export const spanSearchInputToolSchema = {
  description: "Input parameters for searching spans.",
  parameters: spanSearchInputSchema,
};

export const codeSearchInputSchema = z.object({
  directoryPath: z.string().describe("The directory to search in"),
  reasoning: z
    .string()
    .describe(
      "Objectively outline what you observe in the code so far as a numbered list. Then enumerate what other services or areas of the code you may want to explore next if you are missing context."
    ),
});

export type CodeSearchInput = zInfer<typeof codeSearchInputSchema> & { type: "codeSearchInput" };

export const codeSearchInputToolSchema = {
  description: "Input parameters for searching code.",
  parameters: codeSearchInputSchema,
};

export const logPostprocessingSchema = z.object({
  relevantQueries: z
    .array(logSearchInputSchema)
    .describe("List of query strings who's results support the answer."),
  summary: z
    .string()
    .describe(
      "Summary of the log results in the form of a sequence of events (numbered list). Be precise and sequential."
    ),
});

export type LogPostprocessing = zInfer<typeof logPostprocessingSchema> & {
  type: "logPostprocessing";
};

export const logPostprocessingToolSchema = {
  description: "Postprocess log results.",
  parameters: logPostprocessingSchema,
};

export const codePostprocessingSchema = z.object({
  relevantFilepaths: z
    .array(z.string())
    .describe("List of filepaths that contain relevant code to the answer."),
  summary: z
    .string()
    .describe(
      "Summary of the relevant code files and how they contribute to the answer. Be precise and sequential."
    ),
});

export type CodePostprocessing = zInfer<typeof codePostprocessingSchema> & {
  type: "codePostprocessing";
};

export const codePostprocessingToolSchema = {
  description: "Postprocess code results.",
  parameters: codePostprocessingSchema,
};
