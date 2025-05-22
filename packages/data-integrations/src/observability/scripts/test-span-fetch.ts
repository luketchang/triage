#!/usr/bin/env tsx
import { logger } from "@triage/common";
import { Command } from "commander";

import { DatadogCfgSchema, DatadogClient, DatadogConfig, Span, SpansWithPagination } from "../";

// Setup command line options
const program = new Command();

program
  .name("test-span-fetch")
  .description("Test span fetching from Datadog observability platform")
  .option("-p, --client <client>", "Client to test (datadog)", "datadog")
  .option("-q, --query <query>", "Span query to execute", "*")
  .option(
    "-s, --start <datetime>",
    "Start time in ISO format",
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  )
  .option("-e, --end <datetime>", "End time in ISO format", new Date().toISOString())
  .option("-l, --limit <number>", "Maximum number of spans to fetch", "10")
  .parse(process.argv);

const options = program.opts();

// Validate client option
const validClients = ["datadog"];
if (!validClients.includes(options.client)) {
  logger.error(`Invalid client: ${options.client}. Must be one of: ${validClients.join(", ")}`);
  throw new Error(`Invalid client: ${options.client}. Must be one of: ${validClients.join(", ")}`);
}

// Display spans results
function displaySpans(spansWithPagination: SpansWithPagination, client: string): void {
  const spans = spansWithPagination.spans;
  logger.info(`\n${client.toUpperCase()} SPANS:`);

  if (spans.length === 0) {
    logger.info("No spans found for the given query.");
    return;
  }

  const formattedSpans = spans
    .map((span: Span, index: number) => {
      return `[${index + 1}] Span ID: ${span.spanId}
    Service: ${span.service}
    Operation: ${span.operation}
    Trace ID: ${span.traceId}
    Start: ${span.startTime}
    End: ${span.endTime}
    Duration: ${span.duration} ms
    Status: ${span.status || "N/A"}
    Environment: ${span.environment || "N/A"}
    Metadata: ${JSON.stringify(span.metadata, null, 2)}
    `;
    })
    .join("\n\n");

  logger.info(formattedSpans);
}

async function testDatadogSpanFetch(datadogCfg: DatadogConfig): Promise<void> {
  try {
    logger.info("Testing Datadog span fetching...");
    logger.info(`Query: ${options.query}`);
    logger.info(`Time range: ${options.start} to ${options.end}`);
    logger.info(`Limit: ${options.limit}`);

    const datadogClient = new DatadogClient(datadogCfg);
    const spans = await datadogClient.fetchSpans({
      type: "spanSearchInput",
      query: options.query,
      start: options.start,
      end: options.end,
      limit: parseInt(options.limit, 10),
    });

    displaySpans(spans, "datadog");
  } catch (error) {
    logger.error("Error testing Datadog span fetching:", error);
  }
}

async function main(): Promise<void> {
  logger.info("Starting span fetch test...");

  // Check if client configs are available
  if (options.client === "datadog") {
    const datadogCfg = DatadogCfgSchema.parse({
      apiKey: process.env.DATADOG_API_KEY,
      appKey: process.env.DATADOG_APP_KEY,
    });
    await testDatadogSpanFetch(datadogCfg);
  }

  logger.info("Span fetch test completed!");
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  throw error;
});
