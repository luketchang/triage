import {
  Log,
  LogSearchInput,
  LogsWithPagination,
  RetrieveSentryEventInput,
  SentryEvent,
} from "@triage/data-integrations";

import {
  CatToolCallWithResult,
  CodeSearchToolCallWithResult,
  GrepToolCallWithResult,
  LogSearchToolCallWithResult,
} from "./pipeline/state";
import { MaterializedContextItem } from "./types/message.js";

import { AgentStep, ChatMessage, ReasoningStep } from ".";

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

export const formatFacetValues = (facetValues: Map<string, Array<string>>): string => {
  return Array.from(facetValues.entries())
    .map(([facet, values]) => `${facet}: ${values.join(", ")}`)
    .join("\n");
};

export function formatSingleLogSearchToolCallWithResult(step: LogSearchToolCallWithResult): string {
  const input = step.input;
  const logsOrError = step.output;

  let formattedContent: string;
  let pageCursor: string | undefined;

  if (logsOrError.type === "error") {
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
        .map((line, index) => {
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
      .map((line, index) => {
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

// TODO: potentially cut out some fields to reduce noise
export function formatSentryEvent(event: SentryEvent, input?: RetrieveSentryEventInput): string {
  const parts: string[] = [];

  // Add query information if input is provided
  if (input) {
    parts.push(
      `Query: Issue ID ${input.issueId}${input.eventSpecifier ? `, Event ID ${input.eventSpecifier}` : ""}`
    );
  }

  // Basic information
  parts.push(`Event ID: ${event.eventID}`);
  parts.push(`Group ID: ${event.groupID}`);
  parts.push(`Project ID: ${event.projectID}`);
  parts.push(`Date Created: ${event.dateCreated}`);
  parts.push(`Date Received: ${event.dateReceived || "(not provided)"}`);
  parts.push(`Title: ${event.title}`);
  parts.push(`Message: ${event.message || "(no message)"}`);
  parts.push(`Platform: ${event.platform}`);
  parts.push(`Culprit: ${event.culprit || "(not provided)"}`);

  // User information
  if (event.user) {
    parts.push("\nUser:");
    parts.push(`  ID: ${event.user.id || "(anonymous)"}`);
    parts.push(`  Email: ${event.user.email || "(not provided)"}`);
    parts.push(`  Username: ${event.user.username || "(not provided)"}`);
    parts.push(`  Name: ${event.user.name || "(not provided)"}`);

    if (event.user.geo) {
      parts.push("  Geo:");
      Object.entries(event.user.geo).forEach(([key, value]) => {
        parts.push(`    ${key}: ${value}`);
      });
    }
  }

  // Tags
  if (event.tags && event.tags.length > 0) {
    parts.push("\nTags:");
    event.tags.forEach((tag) => {
      parts.push(`  ${tag.key}: ${tag.value}${tag.query ? ` (query: ${tag.query})` : ""}`);
    });
  }

  // Error information
  if (event.entries && event.entries.length > 0) {
    parts.push("\nEntries:");
    event.entries.forEach((entry: any, index: number) => {
      parts.push(`  [${index + 1}] Type: ${entry.type}`);

      // Handle different entry types
      if (entry.type === "exception" && entry.data?.values) {
        parts.push("    Exceptions:");
        entry.data.values.forEach((exception: any, excIndex: number) => {
          parts.push(`      [${excIndex + 1}] ${exception.type}: ${exception.value}`);
          if (exception.stacktrace?.frames) {
            parts.push("        Stacktrace (most relevant frames):");
            // Get the last few frames as they're usually most relevant
            const relevantFrames = exception.stacktrace.frames.slice(-5);
            relevantFrames.forEach((frame: any) => {
              parts.push(
                `          at ${frame.function || "<unknown>"} (${frame.filename}:${frame.lineno}:${frame.colno})`
              );
            });
          }
        });
      } else if (entry.type === "breadcrumbs" && entry.data?.values) {
        parts.push("    Breadcrumbs:");
        entry.data.values.slice(0, 10).forEach((crumb: any, crumbIndex: number) => {
          parts.push(
            `      [${crumbIndex + 1}] ${crumb.timestamp} | ${crumb.level} | ${crumb.category}: ${crumb.message}`
          );
        });
        if (entry.data.values.length > 10) {
          parts.push(`      ... and ${entry.data.values.length - 10} more breadcrumbs`);
        }
      } else if (entry.type === "message" && entry.data) {
        parts.push(`    Message: ${entry.data.message || ""}`);
        parts.push(`    Formatted: ${entry.data.formatted || ""}`);
      } else if (entry.type === "request" && entry.data) {
        parts.push("    Request:");
        parts.push(`      URL: ${entry.data.url || ""}`);
        parts.push(`      Method: ${entry.data.method || ""}`);
      }
    });
  }

  // Context (additional data)
  if (event.context && Object.keys(event.context).length > 0) {
    parts.push("\nContext:");
    Object.entries(event.context).forEach(([key, value]) => {
      parts.push(`  ${key}: ${JSON.stringify(value)}`);
    });
  }

  return parts.join("\n");
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
