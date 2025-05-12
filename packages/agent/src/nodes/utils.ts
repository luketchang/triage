import { Log, LogsWithPagination, Span, SpansWithPagination } from "@triage/observability";

import {
  AgentStep,
  CatStep,
  ChatMessage,
  CodeSearchStep,
  GrepStep,
  LogSearchStep,
  ReasoningStep,
  ReviewStep,
} from "..";
import { LogSearchInput, SpanSearchInput } from "../types/tools";

export function ensureSingleToolCall<T extends { toolName: string }>(toolCalls: T[]): T {
  if (!toolCalls || toolCalls.length !== 1) {
    throw new Error(
      `Expected exactly one tool call, got ${toolCalls?.length}. Calls: ${
        toolCalls?.map((call: { toolName: string }) => call.toolName).join(", ") || ""
      }`
    );
  }

  const toolCall = toolCalls[0];
  if (!toolCall) {
    throw new Error("No tool call found");
  }

  return toolCall;
}

export function formatLogQuery(logQuery: Partial<LogSearchInput>): string {
  return `Query: ${logQuery.query}\nStart: ${logQuery.start}\nEnd: ${logQuery.end}\nLimit: ${logQuery.limit}${
    logQuery.pageCursor ? `\nPage Cursor: ${logQuery.pageCursor}` : ""
  }`;
}

export function formatSpanQuery(spanQuery: Partial<SpanSearchInput>): string {
  return `Query: ${spanQuery.query}\nStart: ${spanQuery.start}\nEnd: ${spanQuery.end}\nPage Limit: ${spanQuery.pageLimit}${
    spanQuery.pageCursor ? `\nPage Cursor: ${spanQuery.pageCursor}` : ""
  }`;
}

export function formatSingleLog(log: Log): string {
  const attributesString = log.attributes
    ? Object.entries(log.attributes)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(", ")
    : "";

  return `[${log.timestamp}] ${log.level.toUpperCase()} [${log.service}] ${log.message}${
    attributesString ? ` [attributes: ${attributesString}]` : ""
  }`;
}

export function formatSingleSpan(span: Span, index?: number): string {
  const indexPrefix = index !== undefined ? `[${index + 1}] ` : "";

  return `${indexPrefix}Span ID: ${span.spanId}
    Service: ${span.service}
    Operation: ${span.operation}
    Trace ID: ${span.traceId}
    Start: ${span.startTime}
    End: ${span.endTime}
    Duration: ${span.duration} ms
    Status: ${span.status || "N/A"}
    Environment: ${span.environment || "N/A"}`;
}

export function formatLogResults(
  logResults: Map<Partial<LogSearchInput>, LogsWithPagination | string>
): string {
  return Array.from(logResults.entries())
    .map(([input, logsOrError]) => {
      let formattedContent: string;
      let pageCursor: string | undefined;

      if (typeof logsOrError === "string") {
        // It's an error message
        formattedContent = `Error: ${logsOrError}`;
        pageCursor = undefined;
      } else {
        // It's a log array
        formattedContent = logsOrError.logs.map((log) => formatSingleLog(log)).join("\n");
        if (!formattedContent) {
          formattedContent = "No logs found";
        }
        pageCursor = logsOrError.pageCursorOrIndicator;
      }

      return `${formatLogQuery(input)}\nPage Cursor Or Indicator: ${pageCursor}\nResults:\n${formattedContent}`;
    })
    .join("\n\n");
}

export function formatSpanResults(
  spanResults: Map<Partial<SpanSearchInput>, SpansWithPagination | string>
): string {
  return Array.from(spanResults.entries())
    .map(([input, spansOrError]) => {
      let formattedContent: string;
      let pageCursor: string | undefined;

      if (typeof spansOrError === "string") {
        // It's an error message
        formattedContent = `Error: ${spansOrError}`;
        pageCursor = undefined;
      } else {
        // It's a spans object
        formattedContent =
          spansOrError.spans.length > 0
            ? spansOrError.spans.map((span, index) => formatSingleSpan(span, index)).join("\n\n")
            : "No spans found";
        pageCursor = spansOrError.pageCursorOrIndicator;
      }

      return `${formatSpanQuery(input)}\nPage Cursor Or Indicator: ${pageCursor}\nResults:\n${formattedContent}`;
    })
    .join("\n\n");
}

export const formatFacetValues = (facetValues: Map<string, Array<string>>): string => {
  return Array.from(facetValues.entries())
    .map(([facet, values]) => `${facet}: ${values.join(", ")}`)
    .join("\n");
};

export function formatSingleLogSearchStep(step: LogSearchStep): string {
  const input = step.input;
  const logsOrError = step.results;

  let formattedContent: string;
  let pageCursor: string | undefined;

  if (typeof logsOrError === "string") {
    // It's an error message
    formattedContent = `Error: ${logsOrError}`;
    pageCursor = undefined;
  } else {
    // It's a log array
    formattedContent = logsOrError.logs.map((log) => formatSingleLog(log)).join("\n");
    if (!formattedContent) {
      formattedContent = "No logs found";
    }
    pageCursor = logsOrError.pageCursorOrIndicator;
  }

  return `${formatLogQuery(input)}\nPage Cursor Or Indicator: ${pageCursor}\nResults:\n${formattedContent}`;
}

export function formatSingleCatStep(
  step: CatStep,
  options: { lineNumbers?: boolean } = {}
): string {
  const header = `File: ${step.path}`;
  const separator = "-".repeat(header.length);

  let source = step.source;
  if (options.lineNumbers) {
    const lines = source.split("\n");
    const maxLineNumberWidth = String(lines.length).length;
    source = lines
      .map((line, index) => {
        const lineNumber = String(index + 1).padStart(maxLineNumberWidth, " ");
        return `${lineNumber} | ${line}`;
      })
      .join("\n");
  }

  return `${separator}\n${header}\n${separator}\n${source}\n`;
}

export function formatSingleGrepStep(step: GrepStep): string {
  // Format input arguments on one line
  const inputArgs = `grep ${step.pattern} ${step.file}${step.flags ? ` -${step.flags}` : ""}`;
  const header = `File: ${step.file}`;
  const separator = "-".repeat(Math.max(header.length, inputArgs.length));

  let source = step.output;
  const lines = source.split("\n");
  const maxLineNumberWidth = String(lines.length).length;
  source = lines
    .map((line, index) => {
      const lineNumber = String(index + 1).padStart(maxLineNumberWidth, " ");
      return `${lineNumber} | ${line}`;
    })
    .join("\n");

  return `${separator}\n${inputArgs}\n${header}\n${separator}\n${source}\n`;
}

export function formatLogSearchSteps(steps: LogSearchStep[]): string {
  return steps
    .map((step) => formatSingleLogSearchStep(step))
    .filter(Boolean)
    .join("\n\n");
}

export function formatCatSteps(steps: CatStep[], options?: { lineNumbers?: boolean }): string {
  return steps.map((step) => formatSingleCatStep(step, options)).join("\n\n");
}

export function formatGrepSteps(steps: GrepStep[]): string {
  return steps.map((step) => formatSingleGrepStep(step)).join("\n\n");
}

export function formatCodeSearchSteps(steps: CodeSearchStep[]): string {
  return steps
    .map((step) => (step.type == "cat" ? formatSingleCatStep(step) : formatSingleGrepStep(step)))
    .join("\n\n");
}

export function formatReasoningStep(step: ReasoningStep): string {
  return `Reasoning: ${step.content}`;
}

export function formatReviewStep(step: ReviewStep): string {
  return `Review: ${step.content}`;
}

export function formatAgentSteps(steps: AgentStep[]): string {
  // Format each step in the original order they were provided
  return steps
    .map((step) => {
      if (step.type === "logSearch") {
        return formatSingleLogSearchStep(step);
      } else if (step.type === "cat") {
        return formatSingleCatStep(step);
      } else if (step.type === "grep") {
        return formatSingleGrepStep(step);
      } else if (step.type === "reasoning") {
        return formatReasoningStep(step);
      } else if (step.type === "review") {
        return formatReviewStep(step);
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function formatCurrentChatHistory(
  chatHistory: ChatMessage[],
  currSteps: AgentStep[]
): string {
  if (!chatHistory || chatHistory.length === 0) {
    return "No conversation history.";
  }

  const chatHistoryString = chatHistory
    .map((message) => {
      if (message.role === "user") {
        return `User:\n${message.content}`;
      } else {
        let formattedMessage = "Assistant:";

        // Add gathered context if there are steps
        if (message.steps && message.steps.length > 0) {
          formattedMessage += `\nGathered Context:\n${formatAgentSteps(message.steps)}`;
        }

        // Add response if it exists
        if (message.response) {
          formattedMessage += `\n\nResponse: ${message.response}`;
        }

        // Add error if it exists
        if (message.error) {
          formattedMessage += `\n\nError: ${message.error}`;
        }

        return formattedMessage;
      }
    })
    .filter(Boolean)
    .join("\n\n");

  const stepsString = formatAgentSteps(currSteps);

  return `${chatHistoryString}\n\n${stepsString}`;
}

export function normalizeDatadogQueryString(query: string): string {
  // Regex pattern to match attribute filters like key:"value" but not service: or status:
  const attributeFilterRegex = /\b(?!service\b)(?!status\b)(\w+):"([^"]+)"/g;

  // Replace matching attribute filters with *:"value"
  const normalizedQuery = query.replace(attributeFilterRegex, '*:"$2"');

  return normalizedQuery;
}

// Browser-compatible path normalization function
export function normalizeFilePath(filePath: string, repoPath: string): string {
  // Ensure paths use consistent separators
  const normalizedFilePath = filePath.replace(/\\/g, "/");
  const normalizedRepoPath = repoPath.replace(/\\/g, "/");

  // If file path starts with repo path, remove it to get the relative path
  if (normalizedFilePath.startsWith(normalizedRepoPath)) {
    // Remove repo path and any leading slashes
    return normalizedFilePath.slice(normalizedRepoPath.length).replace(/^\/+/, "");
  }

  // If file path doesn't start with repo path, it might already be relative
  return normalizedFilePath.replace(/^\/+/, "");
}
