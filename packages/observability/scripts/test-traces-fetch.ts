#!/usr/bin/env ts-node
import { client, v2 } from "@datadog/datadog-api-client";
import { logger } from "@triage/common";

// ================================================================
// Configuration: Set your Datadog API keys and query parameters.
// ================================================================
const DD_API_KEY = "a5c955d31cd7565a3d0ebdb7cd3a7870";
const DD_APP_KEY = "b72ff442938d30d61fbbe2a35980fd170e888515";
const DD_SITE = "datadoghq.com"; // Set your site (e.g., "datadoghq.com" for US, "datadoghq.eu" for EU)

// Set a time window for your queries (adjust as needed)
const FROM_TIME = "2025-04-03T00:00:00Z";
const TO_TIME = "2025-04-07T00:00:00Z";
// Initial query: We want traces where at least one span is from service:tickets
const INITIAL_QUERY = "service:tickets";

// Initialize Datadog client configuration
const configuration = client.createConfiguration({
  authMethods: {
    apiKeyAuth: DD_API_KEY,
    appKeyAuth: DD_APP_KEY,
  },
});

configuration.setServerVariables({
  site: DD_SITE,
});

// Create API clients
const spansApiInstance = new v2.SpansApi(configuration);

// Type definitions
interface Interval {
  start: Date;
  end: Date;
}

interface DisplaySpan {
  id: string;
  parentId?: string;
  service: string;
  operation: string;
  resource: string;
  start: Date;
  end: Date;
  duration: number; // in milliseconds
  tags: Record<string, string>;
  children: DisplaySpan[];
  level: number; // for display indentation
}

// ================================================================
// Helper Functions
// ================================================================

/**
 * Execute a spans search API call and return the response.
 * Uses Datadog API client instead of raw axios.
 */
async function searchSpans(
  query: string,
  fromTime: string,
  toTime: string,
  limit: number = 1000,
  cursor?: string
): Promise<v2.SpansListResponse> {
  try {
    const response = await spansApiInstance.listSpansGet({
      filterQuery: query,
      filterFrom: fromTime,
      filterTo: toTime,
      sort: "timestamp",
      pageLimit: limit,
      pageCursor: cursor,
    });
    return response;
  } catch (error) {
    logger.error(`Error searching spans: ${error}`);
    throw error;
  }
}

/**
 * Extract a set of unique trace IDs from the search results.
 */
function extractTraceIds(searchResults: v2.SpansListResponse): string[] {
  const traceIds = new Set<string>();

  if (searchResults.data) {
    for (const span of searchResults.data) {
      const traceId = span.attributes?.traceId;
      if (traceId) {
        traceIds.add(traceId);
      }
    }
  }

  return Array.from(traceIds);
}

/**
 * Build a single search query string to get all spans for the given list of trace IDs.
 * Returns a list of span events.
 */
async function getAllSpansForTraces(
  traceIds: string[],
  fromTime: string,
  toTime: string,
  limit: number = 1000
): Promise<v2.Span[]> {
  if (traceIds.length === 0) {
    return [];
  }

  // Build query of the form: trace_id:(id1 OR id2 OR id3 ...)
  const query = `trace_id:(${traceIds.join(" OR ")})`;
  const results = await searchSpans(query, fromTime, toTime, limit);
  return results.data || [];
}

/**
 * Given a list of (start, end) datetime tuples,
 * merge overlapping intervals and return the total non-overlapping duration in seconds.
 */
function mergeIntervals(intervals: Interval[]): number {
  if (!intervals.length) {
    return 0;
  }

  // Create a sorted copy of the array to avoid modifying the original
  const sortedIntervals = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());

  // Ensure we have at least one interval
  if (sortedIntervals.length === 0) {
    return 0;
  }

  const merged: Interval[] = [];

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
 * Identify the root span in a trace.
 * The root span is typically the one with no parent or whose parent is not in the trace.
 */
function findRootSpan(spanList: v2.Span[]): [v2.Span | null, number, Date | null, Date | null] {
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
    const spanId = span.attributes?.spanId;
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
function buildTraceHierarchy(spans: v2.Span[]): DisplaySpan[] {
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
        }
      });
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
      tags,
      children: [],
      level: 0, // Will be set later
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
  const sortChildren = (span: DisplaySpan) => {
    span.children.sort((a, b) => a.start.getTime() - b.start.getTime());
    span.children.forEach(sortChildren);
  };

  // Set hierarchy levels and sort
  const setLevels = (span: DisplaySpan, level: number) => {
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
 * Format duration in a human-readable way
 */
function formatDuration(durationMs: number): string {
  if (durationMs < 1) {
    return "<1 µs";
  } else if (durationMs < 1000) {
    return `${durationMs.toFixed(2)} µs`;
  } else if (durationMs < 1000000) {
    return `${(durationMs / 1000).toFixed(2)} ms`;
  } else {
    return `${(durationMs / 1000000).toFixed(2)} s`;
  }
}

/**
 * Compute relative time for visual representation
 */
function computeRelativeTime(time: Date, traceStart: Date): number {
  return (time.getTime() - traceStart.getTime()) / 1000;
}

/**
 * Create a simple text-based waterfall representation of span timing
 */
function createSpanTimingVisual(
  start: number,
  end: number,
  traceDuration: number,
  width: number = 50
): string {
  // Ensure start and end are within bounds [0, traceDuration]
  const safeStart = Math.max(0, Math.min(traceDuration, start));
  const safeEnd = Math.max(0, Math.min(traceDuration, end));

  // Calculate positions
  const startRatio = safeStart / traceDuration;
  const endRatio = safeEnd / traceDuration;

  const startPos = Math.floor(startRatio * width);
  const endPos = Math.ceil(endRatio * width);
  const length = Math.max(1, endPos - startPos);

  return " ".repeat(startPos) + "█".repeat(length) + " ".repeat(Math.max(0, width - endPos));
}

/**
 * Convert DisplaySpan hierarchy to JSON format
 */
function convertSpanToJson(span: DisplaySpan, traceStart: Date): any {
  // Format times
  const relativeStart = computeRelativeTime(span.start, traceStart);
  const relativeEnd = computeRelativeTime(span.end, traceStart);

  // Create JSON representation
  return {
    service: span.service,
    resource: span.resource,
    start: `${relativeStart.toFixed(3)}s`,
    end: `${relativeEnd.toFixed(3)}s`,
    duration: formatDuration(span.duration),
    children: span.children.map((child) => convertSpanToJson(child, traceStart)),
  };
}

/**
 * Display a trace with its hierarchical structure as JSON
 */
function displayTrace(spans: DisplaySpan[], traceId: string): void {
  console.log(`\n==========================================================`);
  console.log(`Trace ID: ${traceId}`);
  console.log(`Total Spans: ${countSpans(spans)}`);

  if (spans.length === 0) {
    console.log("No displayable spans found.");
    return;
  }

  const rootSpan = spans[0];
  if (!rootSpan) {
    console.log("No root span found.");
    return;
  }

  // Find absolute trace start and end times (might be different from root span if some spans are outside)
  let traceStart = rootSpan.start;
  let traceEnd = rootSpan.end;

  // Function to find the earliest start and latest end times among all spans
  const findExtremes = (span: DisplaySpan) => {
    if (span.start < traceStart) traceStart = span.start;
    if (span.end > traceEnd) traceEnd = span.end;
    span.children.forEach(findExtremes);
  };

  // Scan all spans to find true trace start and end times
  spans.forEach(findExtremes);

  const traceDuration = (traceEnd.getTime() - traceStart.getTime()) / 1000;

  // Show basic trace information
  console.log(`Root Service: ${rootSpan.service}`);
  console.log(`Root Resource: ${rootSpan.resource}`);
  console.log(`Root Operation: ${rootSpan.operation}`);
  console.log(`Root Span Duration: ${formatDuration(rootSpan.duration)}`);
  console.log(`Trace Start Time: ${traceStart.toISOString()}`);
  console.log(`Trace End Time: ${traceEnd.toISOString()}`);
  console.log(`Total Trace Duration: ${traceDuration.toFixed(3)} seconds`);

  // Convert spans to JSON format
  const traceJson = {
    trace: spans.map((span) => convertSpanToJson(span, traceStart)),
  };

  // Output JSON
  console.log("\nTrace JSON:");
  console.log(JSON.stringify(traceJson, null, 2));
}

/**
 * Count total spans in a trace hierarchy
 */
function countSpans(spans: DisplaySpan[]): number {
  return spans.reduce((count, span) => {
    return count + 1 + countSpans(span.children);
  }, 0);
}

/**
 * Calculate the service latency breakdown from a list of spans
 * Returns a Map of service names to their durations in seconds
 */
function getServiceLatencyBreakdown(spanList: v2.Span[]): Map<string, number> {
  const serviceIntervals: Record<string, Interval[]> = {};
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
      console.error(`Error parsing timestamps: ${e}`);
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
 * Format the latency breakdown for display
 * Takes a Map of service->duration and the root span duration
 */
function formatLatencyBreakdown(
  serviceBreakdown: Map<string, number>,
  rootDuration: number
): string[] {
  // Sort services by duration (descending)
  const sortedServices = Array.from(serviceBreakdown.entries()).sort((a, b) => b[1] - a[1]);

  // Format each line
  return sortedServices.map(([service, duration]) => {
    const percentage = (duration / rootDuration) * 100;
    return `  Service: ${service.padEnd(20)} Duration: ${duration.toFixed(3).padStart(8)} s  (${percentage.toFixed(1).padStart(5)}%)`;
  });
}

// ================================================================
// Main logic
// ================================================================
async function main(): Promise<void> {
  try {
    // Step 1: Search for spans with the INITIAL_QUERY ("service:tickets")
    console.log("Step 1: Searching for spans with query:", INITIAL_QUERY);
    const searchResult = await searchSpans(INITIAL_QUERY, FROM_TIME, TO_TIME);
    const traceIds = extractTraceIds(searchResult);

    if (traceIds.length === 0) {
      console.log("No trace IDs found for query:", INITIAL_QUERY);
      return;
    }

    console.log(`Found ${traceIds.length} unique trace IDs.`);

    // For demonstration, limit the number of trace ids if there are too many
    const MAX_TRACES_TO_DISPLAY = 15;
    const limitedTraceIds =
      traceIds.length > MAX_TRACES_TO_DISPLAY ? traceIds.slice(0, MAX_TRACES_TO_DISPLAY) : traceIds;
    if (limitedTraceIds.length < traceIds.length) {
      console.log(
        `Limiting analysis to the first ${limitedTraceIds.length} traces for demonstration.`
      );
    }

    // Step 2: Get all spans for these trace IDs with one query.
    console.log("Step 2: Fetching all spans for these trace IDs in one query.");
    const spans = await getAllSpansForTraces(limitedTraceIds, FROM_TIME, TO_TIME);

    if (spans.length === 0) {
      console.log("No spans found for the given trace IDs.");
      return;
    }

    // Group spans by trace_id.
    const traces: Record<string, v2.Span[]> = {};

    for (const span of spans) {
      const tid = span.attributes?.traceId;
      if (!tid) {
        continue;
      }

      if (!traces[tid]) {
        traces[tid] = [];
      }

      traces[tid].push(span);
    }

    console.log(`Retrieved spans for ${Object.keys(traces).length} traces.`);

    // Now process each trace to compute root span duration and latency breakdown by service.
    for (const [traceId, spanList] of Object.entries(traces)) {
      // Build the trace hierarchy for display
      const hierarchicalSpans = buildTraceHierarchy(spanList);

      // Display the trace JSON and high-level info
      displayTrace(hierarchicalSpans, traceId);

      // Find the root span of the trace for latency breakdown
      const [rootSpan, rootDuration, rootStart, rootEnd] = findRootSpan(spanList);

      if (!rootSpan || rootDuration <= 0 || !rootStart || !rootEnd) {
        console.log(
          `Skipping latency breakdown for trace ${traceId}: Unable to identify valid root span`
        );
        continue;
      }

      // Calculate service latency breakdown
      const serviceBreakdown = getServiceLatencyBreakdown(spanList);

      // Format and display the breakdown
      console.log(
        `\nLatency Breakdown by Service (calculated from root span duration: ${rootDuration.toFixed(3)} sec):`
      );
      const formattedBreakdown = formatLatencyBreakdown(serviceBreakdown, rootDuration);
      formattedBreakdown.forEach((line) => console.log(line));
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the main function
main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
