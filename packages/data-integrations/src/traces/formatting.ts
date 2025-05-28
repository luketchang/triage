import type {
  Span,
  SpansWithPagination,
  Trace,
  TracesWithPagination,
} from "./types";

/**
 * Format duration in milliseconds to a human-readable string
 * @param durationMs Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(durationMs: number): string {
  if (durationMs < 1) {
    return `${(durationMs * 1000).toFixed(2)}µs`;
  }
  if (durationMs < 1000) {
    return `${durationMs.toFixed(2)}ms`;
  }
  return `${(durationMs / 1000).toFixed(2)}s`;
}

/**
 * Format trace data for display
 * @param tracesWithPagination Traces with pagination information
 * @returns Formatted string representation of the traces
 */
export function formatTraces(tracesWithPagination: TracesWithPagination): string {
  const traces = tracesWithPagination.traces;
  const parts: string[] = [];

  parts.push(`TRACES (${traces.length} traces found):`);

  if (traces.length === 0) {
    parts.push("No traces found for the given query.");
    return parts.join("\n");
  }

  traces.forEach((trace: Trace, index: number) => {
    parts.push(`[${index + 1}] Trace ID: ${trace.traceId}`);
    parts.push(`    Root Service: ${trace.rootService}`);
    parts.push(`    Root Operation: ${trace.rootOperation}`);
    parts.push(`    Root Resource: ${trace.rootResource}`);
    parts.push(`    Start Time: ${trace.startTime.toISOString()}`);
    parts.push(`    Duration: ${formatDuration(trace.duration)}`);
    parts.push(`    HTTP Status: ${trace.httpStatus || "N/A"}`);
    parts.push(`    Has Error: ${trace.hasError}`);

    // Show latency percentile if available
    const latencyPct = trace.rootLatencyPercentile ?? "N/A";
    parts.push(`    Latency Percentile: ${latencyPct}`);
    parts.push("---");
  });

  if (tracesWithPagination.pageCursorOrIndicator) {
    parts.push(`\nNext Page Cursor: ${tracesWithPagination.pageCursorOrIndicator}`);
  } else {
    parts.push("\nNo more pages available.");
  }

  return parts.join("\n");
}

/**
 * Format spans data for display
 * @param spansWithPagination Spans with pagination information
 * @returns Formatted string representation of the spans
 */
export function formatSpans(spansWithPagination: SpansWithPagination): string {
  const spans = spansWithPagination.spans;
  const parts: string[] = [];

  parts.push("SPANS:");

  if (spans.length === 0) {
    parts.push("No spans found for the given query.");
    return parts.join("\n");
  }

  spans.forEach((span: Span, index: number) => {
    parts.push(`[${index + 1}] Span ID: ${span.spanId}`);
    parts.push(`    Service: ${span.service}`);
    parts.push(`    Operation: ${span.operation}`);
    parts.push(`    Trace ID: ${span.traceId}`);
    parts.push(`    Start: ${span.startTime}`);
    parts.push(`    End: ${span.endTime}`);
    parts.push(`    Duration: ${span.duration} ms`);
    parts.push(`    Status: ${span.status || "N/A"}`);
    parts.push(`    Environment: ${span.environment || "N/A"}`);
    parts.push(`    Metadata: ${JSON.stringify(span.metadata, null, 2)}`);
    parts.push("");
  });

  if (spansWithPagination.pageCursorOrIndicator) {
    parts.push(`Next Page Cursor: ${spansWithPagination.pageCursorOrIndicator}`);
  }

  return parts.join("\n");
}
