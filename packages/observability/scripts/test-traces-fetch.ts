#!/usr/bin/env tsx
import { logger } from "@triage/common";
import { appConfig } from "@triage/config";
import { Command } from "commander";
import { Trace, TracesWithPagination } from "../src"; // Adjust import path if needed
import { DatadogPlatform } from "../src/platforms/datadog"; // Adjust import path if needed

// Setup command line options
const program = new Command();

program
  .name("test-traces-fetch")
  .description("Test trace fetching from Datadog observability platform")
  .option("-p, --platform <platform>", "Platform to test (datadog)", "datadog")
  .option("-q, --query <query>", "Span query to find traces", "*") // Query is based on spans
  .option(
    "-s, --start <datetime>",
    "Start time in ISO format",
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  )
  .option("-e, --end <datetime>", "End time in ISO format", new Date().toISOString())
  .option("-l, --limit <number>", "Maximum number of traces to fetch", "10")
  .parse(process.argv);

const options = program.opts();

// Validate platform option
const validPlatforms = ["datadog"];
if (!validPlatforms.includes(options.platform)) {
  logger.error(
    `Invalid platform: ${options.platform}. Must be one of: ${validPlatforms.join(", ")}`
  );
  process.exit(1);
}

// Format duration helper
const formatDuration = (durationMs: number): string => {
  if (durationMs < 1) {
    return `${(durationMs * 1000).toFixed(2)}µs`;
  }
  if (durationMs < 1000) {
    return `${durationMs.toFixed(2)}ms`;
  }
  return `${(durationMs / 1000).toFixed(2)}s`;
};

// Display traces results
function displayTraces(tracesWithPagination: TracesWithPagination, platform: string): void {
  const traces = tracesWithPagination.traces;
  logger.info(`\n${platform.toUpperCase()} TRACES (${traces.length} traces found):`);

  if (traces.length === 0) {
    logger.info("No traces found for the given query.");
    return;
  }

  traces.forEach((trace: Trace, index: number) => {
    logger.info(`[${index + 1}] Trace ID: ${trace.traceId}`);
    logger.info(`    Root Service: ${trace.rootService}`);
    logger.info(`    Root Operation: ${trace.rootOperation}`);
    logger.info(`    Root Resource: ${trace.rootResource}`);
    logger.info(`    Start Time: ${trace.startTime.toISOString()}`);
    logger.info(`    Duration: ${formatDuration(trace.duration)}`);
    logger.info(`    HTTP Status: ${trace.httpStatus || "N/A"}`);
    logger.info(`    Has Error: ${trace.hasError}`);

    // NEW: show the latency percentile on the root span
    // (we annotated root.latencyPercentile in fetchTraces())
    const latencyPct = trace.rootLatencyPercentile ?? "N/A";
    logger.info(`    Latency Percentile: ${latencyPct}`);

    // Optionally display service breakdown
    // logger.info(`    Service Breakdown: ${JSON.stringify(trace.serviceBreakdown, null, 2)}`);
    logger.info("---");
  });

  if (tracesWithPagination.pageCursorOrIndicator) {
    logger.info(`\nNext Page Cursor: ${tracesWithPagination.pageCursorOrIndicator}`);
  } else {
    logger.info("\nNo more pages available.");
  }
}

async function testDatadogTraceFetch(): Promise<void> {
  try {
    logger.info("Testing Datadog trace fetching...");
    logger.info(`Query: ${options.query}`);
    logger.info(`Time range: ${options.start} to ${options.end}`);
    logger.info(`Limit: ${options.limit}`);

    const datadogPlatform = new DatadogPlatform();
    const tracesResult = await datadogPlatform.fetchTraces({
      query: options.query,
      start: options.start,
      end: options.end,
      limit: 30,
      // pageCursor can be added here if needed for testing pagination
    });

    displayTraces(tracesResult, "datadog");
  } catch (error) {
    logger.error("Error testing Datadog trace fetching:", error);
  }
}

async function main(): Promise<void> {
  logger.info("Starting trace fetch test...");

  // Check if platform configs are available
  if (options.platform === "datadog") {
    if (!appConfig.datadog?.apiKey || !appConfig.datadog?.appKey) {
      logger.error("Datadog API key and App key are required but not found in config");
      process.exit(1);
    }
  }

  try {
    // Run tests based on platform selection
    if (options.platform === "datadog") {
      await testDatadogTraceFetch();
    }
  } catch (error) {
    logger.error("Error during test execution:", error);
    process.exit(1);
  }

  logger.info("Trace fetch test completed!");
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
