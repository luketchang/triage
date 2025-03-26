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

export function formatLogResults(logResults: Map<LogSearchInput, string>): string {
  return Array.from(logResults.entries())
    .map(([input, value]) => `${formatLogQuery(input)}\nResults: ${value}`)
    .join("\n\n");
}

export function formatSpanResults(spanResults: Map<SpanSearchInput, string>): string {
  return Array.from(spanResults.entries())
    .map(([input, value]) => `${formatSpanQuery(input)}\nResults: ${value}`)
    .join("\n\n");
}
