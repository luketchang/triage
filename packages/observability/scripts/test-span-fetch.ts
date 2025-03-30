#!/usr/bin/env tsx
import { logger } from "@triage/common";
import { config } from "@triage/config";
import { Command } from "commander";
import { DatadogPlatform } from "../src";
import { Span } from "../src/types";

// Setup command line options
const program = new Command();

program
  .name("test-span-fetch")
  .description("Test span fetching from Datadog observability platform")
  .option("-p, --platform <platform>", "Platform to test (datadog)", "datadog")
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

// Validate platform option
const validPlatforms = ["datadog"];
if (!validPlatforms.includes(options.platform)) {
  logger.error(
    `Invalid platform: ${options.platform}. Must be one of: ${validPlatforms.join(", ")}`
  );
  process.exit(1);
}

// Display spans results
function displaySpans(spans: Span[], platform: string): void {
  logger.info(`\n${platform.toUpperCase()} SPANS:`);

  if (spans.length === 0) {
    logger.info("No spans found for the given query.");
    return;
  }

  const formattedSpans = spans
    .map((span, index) => {
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

async function testDatadogSpanFetch(): Promise<void> {
  try {
    logger.info("Testing Datadog span fetching...");
    logger.info(`Query: ${options.query}`);
    logger.info(`Time range: ${options.start} to ${options.end}`);
    logger.info(`Limit: ${options.limit}`);

    const datadogPlatform = new DatadogPlatform();
    const spans = await datadogPlatform.fetchSpans({
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

  // Check if platform configs are available
  if (options.platform === "datadog") {
    if (!config.datadog?.apiKey || !config.datadog?.appKey) {
      logger.error("Datadog API key and App key are required but not found in config");
      process.exit(1);
    }
  }

  try {
    // Run tests based on platform selection
    if (options.platform === "datadog") {
      await testDatadogSpanFetch();
    }
  } catch (error) {
    logger.error("Error during test execution:", error);
    process.exit(1);
  }

  logger.info("Span fetch test completed!");
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
