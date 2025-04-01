import { Log, Span } from "@triage/observability";
import { ToolCallUnion, ToolSet } from "ai";
import { LogSearchInput, SpanSearchInput } from "../types";

export function validateToolCalls<TOOLS extends ToolSet>(
  toolCalls: Array<ToolCallUnion<TOOLS>>
): ToolCallUnion<TOOLS> {
  if (!toolCalls || toolCalls.length !== 1) {
    throw new Error(
      `Expected exactly one tool call, got ${toolCalls?.length}. Calls: ${toolCalls?.map((call) => call.toolName).join(", ")}`
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
  return `Query: ${logQuery.query}\nStart: ${logQuery.start}\nEnd: ${logQuery.end}\nLimit: ${logQuery.limit}`;
}

export function formatSpanQuery(spanQuery: Partial<SpanSearchInput>): string {
  return `Query: ${spanQuery.query}\nStart: ${spanQuery.start}\nEnd: ${spanQuery.end}\nLimit: ${spanQuery.pageLimit}`;
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

export function formatLogResults(logResults: Map<LogSearchInput, Log[]>): string {
  return Array.from(logResults.entries())
    .map(([input, logs]) => {
      const formattedLogs = logs.map((log) => formatSingleLog(log)).join("\n");

      return `${formatLogQuery(input)}\nResults:\n${formattedLogs || "No logs found"}`;
    })
    .join("\n\n");
}

export function formatSpanResults(spanResults: Map<SpanSearchInput, Span[]>): string {
  return Array.from(spanResults.entries())
    .map(([input, spans]) => {
      const formattedSpans =
        spans.length > 0
          ? spans.map((span, index) => formatSingleSpan(span, index)).join("\n\n")
          : "No spans found";

      return `${formatSpanQuery(input)}\nResults:\n${formattedSpans}`;
    })
    .join("\n\n");
}
