#!/usr/bin/env tsx
import { logger } from "@triage/common";
import { Command } from "commander";

import {
  DatadogCfgSchema,
  DatadogClient,
  DatadogConfig,
  GrafanaCfgSchema,
  GrafanaClient,
  GrafanaConfig,
  LogsWithPagination,
} from "..";

// Setup command line options
const program = new Command();

program
  .name("test-log-fetch")
  .description("Test log fetching from Datadog and Grafana observability platforms")
  .option("-p, --client <client>", "Client to test (datadog, grafana, or both)", "both")
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

// Validate client option
const validClients = ["datadog", "grafana", "both"];
if (!validClients.includes(options.client)) {
  logger.error(`Invalid client: ${options.client}. Must be one of: ${validClients.join(", ")}`);
  process.exit(1);
}

// Display formatted logs
function displayLogs(logsWithPagination: LogsWithPagination, client: string): void {
  const logs = logsWithPagination.logs;
  logger.info(`\n${client.toUpperCase()} LOGS (${logs.length} logs found):`);

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

async function testDatadogLogFetch(datadogCfg: DatadogConfig): Promise<void> {
  try {
    logger.info("Testing Datadog log fetching...");
    logger.info(`Query: ${options.query}`);
    logger.info(`Time range: ${options.start} to ${options.end}`);
    logger.info(`Limit: ${options.limit}`);

    const datadogClient = new DatadogClient(datadogCfg);
    const logs = await datadogClient.fetchLogs({
      type: "logSearchInput",
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

async function testGrafanaLogFetch(grafanaCfg: GrafanaConfig): Promise<void> {
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

    const grafanaClient = new GrafanaClient(grafanaCfg);
    const logs = await grafanaClient.fetchLogs({
      type: "logSearchInput",
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

  if (options.client === "datadog" || options.client === "both") {
    const datadogCfg = DatadogCfgSchema.parse({
      apiKey: process.env.DATADOG_API_KEY,
      appKey: process.env.DATADOG_APP_KEY,
    });
    await testDatadogLogFetch(datadogCfg);
  }
  if (options.client === "grafana" || options.client === "both") {
    const grafanaCfg = GrafanaCfgSchema.parse({
      baseUrl: process.env.GRAFANA_BASE_URL,
      username: process.env.GRAFANA_USERNAME,
      password: process.env.GRAFANA_PASSWORD,
    });
    await testGrafanaLogFetch(grafanaCfg);
  }

  logger.info("Log fetch test completed!");
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
