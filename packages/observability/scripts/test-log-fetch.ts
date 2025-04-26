#!/usr/bin/env tsx
import { logger } from "@triage/common";
import { config } from "@triage/config";
import { Command } from "commander";
import { DatadogPlatform, GrafanaPlatform, LogsWithPagination } from "../src";

// Setup command line options
const program = new Command();

program
  .name("test-log-fetch")
  .description("Test log fetching from Datadog and Grafana observability platforms")
  .option("-p, --platform <platform>", "Platform to test (datadog, grafana, or both)", "both")
  .option("-q, --query <query>", "Log query to execute", "*")
  .option(
    "-s, --start <datetime>",
    "Start time in ISO format",
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  )
  .option("-e, --end <datetime>", "End time in ISO format", new Date().toISOString())
  .option("-l, --limit <number>", "Maximum number of logs to fetch", "10")
  .parse(process.argv);

const options = program.opts();

// Validate platform option
const validPlatforms = ["datadog", "grafana", "both"];
if (!validPlatforms.includes(options.platform)) {
  logger.error(
    `Invalid platform: ${options.platform}. Must be one of: ${validPlatforms.join(", ")}`
  );
  process.exit(1);
}

// Display formatted logs
function displayLogs(logsWithPagination: LogsWithPagination, platform: string): void {
  const logs = logsWithPagination.logs;
  logger.info(`\n${platform.toUpperCase()} LOGS (${logs.length} logs found):`);

  if (logs.length === 0) {
    logger.info("No logs found for the given query.");
    return;
  }

  logs.forEach((log, index) => {
    logger.info(`[${index + 1}] ${log.service} | ${log.timestamp} | ${log.level} | ${log.message}`);

    // Only show metadata if it's not empty
    const metadataEntries = Object.entries(log.metadata || {});
    if (metadataEntries.length > 0) {
      logger.info(`    Metadata: ${JSON.stringify(log.metadata, null, 2)}`);
    }
    if (log.attributes) {
      logger.info(`    Attributes: ${JSON.stringify(log.attributes, null, 2)}`);
    }
  });
}

async function testDatadogLogFetch(): Promise<void> {
  try {
    logger.info("Testing Datadog log fetching...");
    logger.info(`Query: ${options.query}`);
    logger.info(`Time range: ${options.start} to ${options.end}`);
    logger.info(`Limit: ${options.limit}`);

    const datadogPlatform = new DatadogPlatform();
    const logs = await datadogPlatform.fetchLogs({
      query: options.query,
      start: options.start,
      end: options.end,
      limit: parseInt(options.limit, 10),
    });

    displayLogs(logs, "datadog");
  } catch (error) {
    logger.error("Error testing Datadog log fetching:", error);
  }
}

async function testGrafanaLogFetch(): Promise<void> {
  try {
    logger.info("Testing Grafana log fetching...");
    logger.info(`Query: ${options.query}`);
    logger.info(`Time range: ${options.start} to ${options.end}`);
    logger.info(`Limit: ${options.limit}`);

    // For Grafana, we need to ensure the query is in the correct format (LogQL)
    // If user provided simple query, format it as a LogQL query
    let grafanaQuery = options.query;
    if (!grafanaQuery.includes("{") && !grafanaQuery.startsWith("{")) {
      // Default simple query to check all logs with a keyword filter if provided
      grafanaQuery = '{job=~".+"}';
      if (options.query !== "*") {
        grafanaQuery += ` |= "${options.query}"`;
      }
    }

    logger.info(`Formatted Grafana query: ${grafanaQuery}`);

    const grafanaPlatform = new GrafanaPlatform();
    const logs = await grafanaPlatform.fetchLogs({
      query: grafanaQuery,
      start: options.start,
      end: options.end,
      limit: parseInt(options.limit, 10),
    });

    displayLogs(logs, "grafana");
  } catch (error) {
    logger.error("Error testing Grafana log fetching:", error);
  }
}

async function main(): Promise<void> {
  logger.info("Starting log fetch test...");

  // Check if platform configs are available
  if (options.platform === "datadog" || options.platform === "both") {
    if (!config.datadog?.apiKey || !config.datadog?.appKey) {
      logger.error("Datadog API key and App key are required but not found in config");
      if (options.platform === "datadog") {
        process.exit(1);
      }
    }
  }

  if (options.platform === "grafana" || options.platform === "both") {
    if (!config.grafana?.baseUrl || !config.grafana?.username || !config.grafana?.password) {
      logger.error("Grafana base URL, username, and password are required but not found in config");
      if (options.platform === "grafana") {
        process.exit(1);
      }
    }
  }

  try {
    // Run tests based on platform selection
    if (options.platform === "datadog" || options.platform === "both") {
      await testDatadogLogFetch();
    }

    if (options.platform === "grafana" || options.platform === "both") {
      await testGrafanaLogFetch();
    }
  } catch (error) {
    logger.error("Error during test execution:", error);
    process.exit(1);
  }

  logger.info("Log fetch test completed!");
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
