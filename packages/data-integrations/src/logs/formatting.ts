import type {
  Log,
  LogSearchInput,
  LogsWithPagination,
} from "./types";

/**
 * Format a log search query
 * @param logQuery Log search input parameters
 * @returns Formatted string representation of the log query
 */
export function formatLogQuery(logQuery: Partial<LogSearchInput>): string {
  return `Query: ${logQuery.query}\nStart: ${logQuery.start}\nEnd: ${logQuery.end}\nLimit: ${logQuery.limit}${
    logQuery.pageCursor ? `\nPage Cursor: ${logQuery.pageCursor}` : ""
  }`;
}

/**
 * Format a single log entry
 * @param log Log entry to format
 * @returns Formatted string representation of the log
 */
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

/**
 * Format log results
 * @param logResults Map of log search inputs to their results or error messages
 * @returns Formatted string representation of the log results
 */
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
