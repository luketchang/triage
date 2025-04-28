import { v2 } from "@datadog/datadog-api-client";
import { logger } from "@triage/common";

import { DisplaySpan, DisplayTrace, ServiceLatency, SpanError, Trace } from "../../types";

/**
 * Extract a set of unique trace IDs from search results.
 */
export function extractTraceIds(spans: v2.Span[]): string[] {
  const traceIds = new Set<string>();

  if (spans && spans.length > 0) {
    for (const span of spans) {
      const traceId = span.attributes?.traceId;
      if (traceId) {
        traceIds.add(traceId);
      }
    }
  }

  return Array.from(traceIds);
}

/**
 * Find the root span in a trace.
 * The root span is typically the one with no parent or whose parent is not in the trace.
 */
export function findRootSpan(
  spanList: v2.Span[]
): [v2.Span | null, number, Date | null, Date | null] {
  if (!spanList.length) {
    return [null, 0, null, null];
  }

  // First, extract all span IDs and parent span IDs
  const spanIds = new Set<string>();
  const spanIdToObj: Record<string, v2.Span> = {};

  for (const span of spanList) {
    const spanId = span.attributes?.spanId;
    if (spanId) {
      spanIds.add(spanId);
      spanIdToObj[spanId] = span;
    }
  }

  // Find spans that have no parent or parent outside this trace
  const rootCandidates: v2.Span[] = [];

  for (const span of spanList) {
    const parentId = span.attributes?.parentId;

    // Root span either has no parent_id or its parent is not in this trace
    if (!parentId || !spanIds.has(parentId)) {
      rootCandidates.push(span);
    }
  }

  // If we have multiple candidates, choose the one with the earliest start time
  if (rootCandidates.length === 0) {
    return [null, 0, null, null];
  }

  if (rootCandidates.length > 1) {
    rootCandidates.sort((a, b) => {
      const aTimestamp = a.attributes?.startTimestamp ?? "9999";
      const bTimestamp = b.attributes?.startTimestamp ?? "9999";
      // Ensure we're comparing strings
      return String(aTimestamp).localeCompare(String(bTimestamp));
    });
  }

  const rootSpan = rootCandidates[0];
  if (!rootSpan) {
    return [null, 0, null, null];
  }

  // Calculate root span duration
  const startStr = rootSpan.attributes?.startTimestamp;
  const endStr = rootSpan.attributes?.endTimestamp;

  if (!startStr || !endStr) {
    return [rootSpan, 0, null, null];
  }

  try {
    const startDt = new Date(startStr);
    const endDt = new Date(endStr);
    const duration = (endDt.getTime() - startDt.getTime()) / 1000;
    return [rootSpan, duration, startDt, endDt];
  } catch (e) {
    logger.error(`Error parsing timestamps for root span: ${e}`);
    return [rootSpan, 0, null, null];
  }
}

/**
 * Convert Datadog spans to a more display-friendly format with parent-child relationships
 */
export function buildTraceHierarchy(spans: v2.Span[]): DisplaySpan[] {
  // Map to store spans by their ID for quick lookup
  const spanMap = new Map<string, DisplaySpan>();

  // Convert raw spans to DisplaySpan format
  spans.forEach((span) => {
    if (!span.attributes) return;

    const spanId = span.attributes.spanId;
    if (!spanId) return;

    const startTimestamp = span.attributes.startTimestamp;
    const endTimestamp = span.attributes.endTimestamp;

    if (!startTimestamp || !endTimestamp) return;

    const startDate = new Date(startTimestamp);
    const endDate = new Date(endTimestamp);
    const durationMs = endDate.getTime() - startDate.getTime();

    // Extract relevant tags
    const tags: Record<string, string> = {};
    // Access meta data safely with type checking
    if (span.attributes.additionalProperties) {
      Object.entries(span.attributes.additionalProperties).forEach(([key, value]) => {
        if (typeof value === "string") {
          tags[key] = value;
        } else if (value !== null && value !== undefined) {
          tags[key] = String(value);
        }
      });
    }

    // Check for error information
    let error: SpanError | undefined;
    const errorType = tags["error.type"];
    const errorMsg = tags["error.msg"];
    const errorStack = tags["error.stack"];

    if (errorType || errorMsg) {
      error = {
        type: errorType || "Unknown error",
        message: errorMsg || errorType || "Unknown error",
        stack: errorStack,
      };
    }

    // Create DisplaySpan
    const displaySpan: DisplaySpan = {
      id: spanId,
      parentId: span.attributes.parentId,
      service: span.attributes.service || "unknown",
      operation: span.attributes.additionalProperties?.operation_name || "unknown",
      resource: span.attributes.resourceName || "unknown",
      start: startDate,
      end: endDate,
      duration: durationMs,
      status: span.attributes.additionalProperties?.status,
      tags,
      children: [],
      level: 0, // Will be set later
      error,
    };

    spanMap.set(spanId, displaySpan);
  });

  // Build parent-child relationships
  const rootSpans: DisplaySpan[] = [];

  spanMap.forEach((span) => {
    if (!span.parentId || !spanMap.has(span.parentId)) {
      // This is a root span
      rootSpans.push(span);
    } else {
      // Add as child to parent
      const parentSpan = spanMap.get(span.parentId);
      if (parentSpan) {
        parentSpan.children.push(span);
      }
    }
  });

  // Sort children by start time
  const sortChildren = (span: DisplaySpan): void => {
    span.children.sort((a, b) => a.start.getTime() - b.start.getTime());
    span.children.forEach(sortChildren);
  };

  // Set hierarchy levels and sort
  const setLevels = (span: DisplaySpan, level: number): void => {
    span.level = level;
    span.children.forEach((child) => setLevels(child, level + 1));
  };

  rootSpans.forEach((rootSpan) => {
    setLevels(rootSpan, 0);
    sortChildren(rootSpan);
  });

  // Sort root spans by start time
  rootSpans.sort((a, b) => a.start.getTime() - b.start.getTime());

  return rootSpans;
}

/**
 * Given a list of (start, end) datetime tuples,
 * merge overlapping intervals and return the total non-overlapping duration in seconds.
 */
export function mergeIntervals(intervals: { start: Date; end: Date }[]): number {
  if (!intervals.length) {
    return 0;
  }

  // Create a sorted copy of the array to avoid modifying the original
  const sortedIntervals = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());

  // Ensure we have at least one interval
  if (sortedIntervals.length === 0) {
    return 0;
  }

  const merged: { start: Date; end: Date }[] = [];

  // Use the first interval with null check
  if (sortedIntervals.length > 0 && sortedIntervals[0]) {
    let currentStart = sortedIntervals[0].start;
    let currentEnd = sortedIntervals[0].end;

    for (let i = 1; i < sortedIntervals.length; i++) {
      const interval = sortedIntervals[i];
      // Always check if interval exists before accessing properties
      if (!interval) continue;

      if (interval.start.getTime() <= currentEnd.getTime()) {
        currentEnd = new Date(Math.max(currentEnd.getTime(), interval.end.getTime()));
      } else {
        merged.push({ start: currentStart, end: currentEnd });
        currentStart = interval.start;
        currentEnd = interval.end;
      }
    }

    merged.push({ start: currentStart, end: currentEnd });
  }

  const total = merged.reduce((sum, { start, end }) => {
    return sum + (end.getTime() - start.getTime()) / 1000;
  }, 0);

  return total;
}

/**
 * Calculate the service latency breakdown from a list of spans
 * Returns a Map of service names to their durations in seconds
 */
export function getServiceLatencyBreakdown(spanList: v2.Span[]): Map<string, number> {
  const serviceIntervals: Record<string, { start: Date; end: Date }[]> = {};
  const serviceBreakdown = new Map<string, number>();

  // Process each span in the trace for service breakdown
  for (const span of spanList) {
    const startStr = span.attributes?.startTimestamp;
    const endStr = span.attributes?.endTimestamp;
    const service = span.attributes?.service || "unknown";

    if (!startStr || !endStr) {
      continue;
    }

    try {
      const startDt = new Date(startStr);
      const endDt = new Date(endStr);

      if (!serviceIntervals[service]) {
        serviceIntervals[service] = [];
      }

      serviceIntervals[service].push({ start: startDt, end: endDt });
    } catch (e) {
      logger.error(`Error parsing timestamps: ${e}`);
      continue;
    }
  }

  // Calculate the non-overlapping duration for each service
  for (const [service, intervals] of Object.entries(serviceIntervals)) {
    const svcDuration = mergeIntervals(intervals);
    serviceBreakdown.set(service, svcDuration);
  }

  return serviceBreakdown;
}

/**
 * Process service latency breakdown into an array of ServiceLatency objects
 */
export function formatServiceBreakdown(
  serviceBreakdown: Map<string, number>,
  rootDuration: number
): ServiceLatency[] {
  const result: ServiceLatency[] = [];

  // Convert the Map to an array of ServiceLatency objects
  serviceBreakdown.forEach((duration, service) => {
    const percentage = (duration / rootDuration) * 100;
    result.push({
      service,
      duration,
      percentage,
    });
  });

  // Sort by duration (descending)
  result.sort((a, b) => b.duration - a.duration);

  return result;
}

/**
 * Extract HTTP status code from a span if available
 */
export function extractHttpStatus(spanList: v2.Span[]): string | undefined {
  for (const span of spanList) {
    if (span.attributes?.additionalProperties) {
      const statusCode = span.attributes?.custom?.http?.status_code;
      if (statusCode) {
        return String(statusCode);
      }
    }
  }
  return undefined;
}

/**
 * Check if a trace has any errors
 */
export function hasErrors(spanList: v2.Span[]): boolean {
  for (const span of spanList) {
    if (span.attributes?.additionalProperties) {
      const props = span.attributes.additionalProperties;
      if (
        props["error"] === "true" ||
        props["error.type"] ||
        props["error.msg"] ||
        props["error.stack"] ||
        (props["http.status_code"] && parseInt(String(props["http.status_code"])) >= 400)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Convert a list of Datadog spans into a structured Trace object
 */
export function convertSpansToTrace(spanList: v2.Span[], traceId: string): Trace | null {
  if (!spanList || spanList.length === 0) {
    logger.info(`No spans found for trace ID: ${traceId}`);
    return null;
  }

  // Find the root span
  const [rootSpan, rootDuration, rootStart, rootEnd] = findRootSpan(spanList);

  if (!rootSpan || !rootStart || !rootEnd || rootDuration <= 0) {
    logger.info(`Could not identify valid root span for trace ID: ${traceId}`);
    return null;
  }

  // Build the trace hierarchy (spans with parent-child relationships)
  const hierarchicalSpans = buildTraceHierarchy(spanList);

  if (hierarchicalSpans.length === 0) {
    logger.info(`Could not build trace hierarchy for trace ID: ${traceId}`);
    return null;
  }

  // Find root span in hierarchical format
  const rootDisplaySpan = hierarchicalSpans[0];

  // Check if rootDisplaySpan exists
  if (!rootDisplaySpan) {
    logger.info(`Root display span not found for trace ID: ${traceId}`);
    return null;
  }

  // Calculate trace boundaries (might be different from root span if some spans are outside)
  let traceStart = rootDisplaySpan.start;
  let traceEnd = rootDisplaySpan.end;

  // Find the earliest start and latest end times among all spans
  const findExtremes = (span: DisplaySpan): void => {
    if (span.start < traceStart) traceStart = span.start;
    if (span.end > traceEnd) traceEnd = span.end;
    span.children.forEach(findExtremes);
  };

  // Scan all spans to find true trace start and end times
  hierarchicalSpans.forEach(findExtremes);

  const totalDuration = traceEnd.getTime() - traceStart.getTime();

  // Create the display trace object
  const displayTrace: DisplayTrace = {
    traceId,
    rootSpan: rootDisplaySpan,
    spans: hierarchicalSpans,
    startTime: traceStart,
    endTime: traceEnd,
    totalDuration,
  };

  // Calculate service latency breakdown
  const serviceBreakdown = getServiceLatencyBreakdown(spanList);
  const formattedBreakdown = formatServiceBreakdown(serviceBreakdown, rootDuration);

  // Determine if the trace has any errors
  const hasError = hasErrors(spanList);

  // Extract HTTP status code if available
  const httpStatus = extractHttpStatus(spanList);

  // Create the final Trace object
  return {
    traceId,
    rootService: rootSpan.attributes?.service || "unknown",
    rootOperation: rootSpan.attributes?.additionalProperties?.operation_name || "unknown",
    rootResource: rootSpan.attributes?.resourceName || "unknown",
    httpStatus,
    startTime: traceStart,
    endTime: traceEnd,
    duration: totalDuration,
    serviceBreakdown: formattedBreakdown,
    hasError,
    displayTrace,
  };
}
