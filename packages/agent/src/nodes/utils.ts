import { ToolCallUnion, ToolSet } from "ai";

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

export function formatLogResults(logResults: Record<string, string>): string {
  return Object.entries(logResults)
    .map(([key, value]) => `${key}\n${value}`)
    .join("\n\n");
}
