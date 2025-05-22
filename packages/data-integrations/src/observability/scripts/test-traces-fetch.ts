#!/usr/bin/env tsx
import { logger } from "@triage/common";
import { Command } from "commander";
import { DatadogCfgSchema, DatadogConfig, Trace, TracesWithPagination } from "../src";
import { DatadogClient } from "../src/clients/datadog";

// Setup command line options
const program = new Command();

program
  .name("test-traces-fetch")
  .description("Test trace fetching from Datadog observability client")
  .option("-p, --client <client>", "Client to test (datadog)", "datadog")
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

// Validate client option
const validClients = ["datadog"];
if (!validClients.includes(options.client)) {
  logger.error(`Invalid client: ${options.client}. Must be one of: ${validClients.join(", ")}`);
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
function displayTraces(tracesWithPagination: TracesWithPagination, client: string): void {
  const traces = tracesWithPagination.traces;
  logger.info(`\n${client.toUpperCase()} TRACES (${traces.length} traces found):`);

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

async function testDatadogTraceFetch(datadogCfg: DatadogConfig): Promise<void> {
  try {
    logger.info("Testing Datadog trace fetching...");
    logger.info(`Query: ${options.query}`);
    logger.info(`Time range: ${options.start} to ${options.end}`);
    logger.info(`Limit: ${options.limit}`);

    const datadogClient = new DatadogClient(datadogCfg);
    const tracesResult = await datadogClient.fetchTraces({
      type: "traceSearchInput",
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

  // Check if client configs are available
  if (options.client === "datadog") {
    const datadogCfg = DatadogCfgSchema.parse({
      apiKey: process.env.DATADOG_API_KEY,
      appKey: process.env.DATADOG_APP_KEY,
    });
    await testDatadogTraceFetch(datadogCfg);
  }

  logger.info("Trace fetch test completed!");
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
