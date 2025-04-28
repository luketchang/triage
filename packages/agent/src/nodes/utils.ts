import { Log, LogsWithPagination, Span, SpansWithPagination } from "@triage/observability";

import { LogSearchInput, SpanSearchInput } from "../types";

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

export function formatChatHistory(chatHistory: string[]): string {
  return chatHistory.length > 0
    ? "\n\n" + chatHistory.map((entry, i) => `${i + 1}. ${entry}`).join("\n\n")
    : "No previous context gathered.";
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
