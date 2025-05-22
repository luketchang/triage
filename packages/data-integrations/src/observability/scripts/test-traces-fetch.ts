#!/usr/bin/env tsx
import { logger } from "@triage/common";
import { Command } from "commander";

import { DatadogCfgSchema, DatadogConfig, Trace, TracesWithPagination, formatTraces } from "../";
import { DatadogClient } from "../clients/datadog";

// Setup command line options
const program = new Command();

program
  .name("test-traces-fetch")
  .description("Test trace fetching from Datadog observability platform")
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
  throw new Error(`Invalid client: ${options.client}. Must be one of: ${validClients.join(", ")}`);
}

// We'll use the formatDuration from the formatting module

// Display traces results
function displayTraces(tracesWithPagination: TracesWithPagination, client: string): void {
  // Use the formatTraces function from the formatting module
  const formattedTraces = formatTraces(tracesWithPagination);
  logger.info(`\n${client.toUpperCase()} ${formattedTraces}`);
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
  throw error;
});
