import { formatLogQuery, formatSentryEvent, formatSingleLog } from "@triage/data-integrations";

import {
  AgentStep,
  CatToolCallWithResult,
  CodeSearchToolCallWithResult,
  GrepToolCallWithResult,
  LogSearchToolCallWithResult,
  ReasoningStep,
} from "./pipeline/state";
import { ChatMessage, MaterializedContextItem } from "./types";
import { UserMessage } from "./types/message";

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

export function formatFacetValues(facetValues: Map<string, Array<string>>): string {
  return Array.from(facetValues.entries())
    .map(([facet, values]) => `${facet}: ${values.join(", ")}`)
    .join("\n");
}

export function formatSingleLogSearchToolCallWithResult(step: LogSearchToolCallWithResult): string {
  const input = step.input;
  const logsOrError = step.output;

  let formattedContent: string;
  let pageCursor: string | undefined;

  if (logsOrError.type === "error") {
    // It's an error message
    formattedContent = `Error: ${logsOrError.error}`;
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

export function formatSingleCatToolCallWithResult(
  step: CatToolCallWithResult,
  options: { lineNumbers?: boolean } = {}
): string {
  const header = `File: ${step.input.path}`;
  const separator = "-".repeat(header.length);

  if (step.output.type === "error") {
    return `${separator}\n${header}\n${separator}\n${step.output.error}\n`;
  } else {
    let source = step.output.content;
    if (options.lineNumbers) {
      const lines = source.split("\n");
      const maxLineNumberWidth = String(lines.length).length;
      source = lines
        .map((line: string, index: number) => {
          const lineNumber = String(index + 1).padStart(maxLineNumberWidth, " ");
          return `${lineNumber} | ${line}`;
        })
        .join("\n");
    }

    return `${separator}\n${header}\n${separator}\n${source}\n`;
  }
}

export function formatSingleGrepToolCallWithResult(step: GrepToolCallWithResult): string {
  // Format input arguments on one line
  const inputArgs = `git grep ${step.input.pattern} ${step.input.flags ? ` -${step.input.flags}` : ""}`;
  const separator = "-".repeat(inputArgs.length);

  if (step.output.type === "error") {
    return `${separator}\n${inputArgs}\n${separator}\n${step.output.error}\n`;
  } else {
    let source = step.output.content;
    const lines = source.split("\n");
    const maxLineNumberWidth = String(lines.length).length;
    source = lines
      .map((line: string, index: number) => {
        const lineNumber = String(index + 1).padStart(maxLineNumberWidth, " ");
        return `${lineNumber} | ${line}`;
      })
      .join("\n");

    return `${separator}\n${inputArgs}\n${separator}\n${source}\n`;
  }
}

export function formatMaterializedContextItem(item: MaterializedContextItem): string {
  if (item.type === "log") {
    let formattedContent: string;
    let pageCursor: string | undefined;

    formattedContent = item.output.logs.map((log) => formatSingleLog(log)).join("\n");
    if (!formattedContent) {
      formattedContent = "No logs found";
    }
    pageCursor = item.output.pageCursorOrIndicator;

    return `${formatLogQuery(item.input)}\nPage Cursor Or Indicator: ${pageCursor}\nResults:\n${formattedContent}`;
  } else if (item.type === "sentry") {
    return formatSentryEvent(item.output, item.input);
  }

  return "Unknown context item type";
}

export function formatLogSearchToolCallsWithResults(steps: LogSearchToolCallWithResult[]): string {
  return steps
    .map((step) => formatSingleLogSearchToolCallWithResult(step))
    .filter(Boolean)
    .join("\n\n");
}

export function formatCatToolCallsWithResults(
  steps: CatToolCallWithResult[],
  options?: { lineNumbers?: boolean }
): string {
  return steps.map((step) => formatSingleCatToolCallWithResult(step, options)).join("\n\n");
}

export function formatGrepToolCalls(steps: GrepToolCallWithResult[]): string {
  return steps.map((step) => formatSingleGrepToolCallWithResult(step)).join("\n\n");
}

export function formatCodeSearchToolCallsWithResults(
  steps: CodeSearchToolCallWithResult[]
): string {
  const grepToolCalls = steps.filter(
    (step): step is GrepToolCallWithResult => step.type === "grep"
  );
  const catToolCalls = steps.filter((step): step is CatToolCallWithResult => step.type === "cat");

  const allToolCalls = [...grepToolCalls, ...catToolCalls].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  return allToolCalls
    .map((step) => {
      if (step.type === "grep") {
        return formatSingleGrepToolCallWithResult(step);
      } else {
        return formatSingleCatToolCallWithResult(step);
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

export function formatReasoningStep(step: ReasoningStep): string {
  return `Reasoning: ${step.data}`;
}

export function formatAgentSteps(steps: AgentStep[]): string {
  // Format each step in the original order they were provided
  return steps
    .map((step) => {
      if (step.type === "logSearch") {
        return formatLogSearchToolCallsWithResults(step.data);
      } else if (step.type === "codeSearch") {
        return formatCodeSearchToolCallsWithResults(step.data);
      } else if (step.type === "reasoning") {
        return formatReasoningStep(step);
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function formatUserMessage(userMessage: UserMessage): string {
  let formattedMessage = `--- User ---\n${userMessage.content}`;

  // Add context items if they exist
  if (userMessage.contextItems && userMessage.contextItems.length > 0) {
    formattedMessage += "\n\nAttached Context:";

    userMessage.contextItems.forEach((item) => {
      formattedMessage += `\n\n${formatMaterializedContextItem(item)}`;
    });
  }

  return formattedMessage;
}

export function formatAssistantMessage(message: ChatMessage): string {
  if (message.role !== "assistant") {
    throw new Error("Expected assistant message");
  }

  const assistantMessage = message;
  let formattedMessage = `--- Assistant ---\n`;

  // Add context if there are steps
  if (assistantMessage.steps && assistantMessage.steps.length > 0) {
    formattedMessage += `\nGathered Context:\n${formatAgentSteps(assistantMessage.steps)}`;
  }

  // Add response if it exists
  if (assistantMessage.response) {
    formattedMessage += `\n\nResponse:\n${assistantMessage.response}`;
  }

  // Add error if it exists
  if (assistantMessage.error) {
    formattedMessage += `\n\nError:\n${assistantMessage.error}`;
  }

  return formattedMessage;
}

export function formatCurrentChatHistory(
  chatHistory: ChatMessage[],
  currSteps: AgentStep[]
): string {
  if (!chatHistory || chatHistory.length === 0) {
    return "";
  }

  const chatHistoryString = chatHistory
    .map((message) => {
      if (message.role === "user") {
        return formatUserMessage(message);
      } else {
        return formatAssistantMessage(message);
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
