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
import { formatLogQuery, formatSingleLog } from "../formatting";

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
  throw new Error(`Invalid client: ${options.client}. Must be one of: ${validClients.join(", ")}`);
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
    // Use the formatSingleLog function from the formatting module
    const formattedLog = formatSingleLog(log);
    logger.info(`[${index + 1}] ${formattedLog}`);

    // Only show metadata if it's not empty and not already included in the formatted log
    const metadataEntries = Object.entries(log.metadata || {});
    if (metadataEntries.length > 0) {
      logger.info(`    Metadata: ${JSON.stringify(log.metadata, null, 2)}`);
    }
  });
}

async function testDatadogLogFetch(datadogCfg: DatadogConfig): Promise<void> {
  try {
    logger.info("Testing Datadog log fetching...");

    const logSearchInput = {
      query: options.query,
      start: options.start,
      end: options.end,
      limit: parseInt(options.limit, 10),
    };

    // Use the formatLogQuery function to display the query
    logger.info(formatLogQuery(logSearchInput));

    const datadogClient = new DatadogClient(datadogCfg);
    const logs = await datadogClient.fetchLogs({
      type: "logSearchInput",
      ...logSearchInput,
    });

    displayLogs(logs, "datadog");
  } catch (error) {
    logger.error("Error testing Datadog log fetching:", error);
  }
}

async function testGrafanaLogFetch(grafanaCfg: GrafanaConfig): Promise<void> {
  try {
    logger.info("Testing Grafana log fetching...");

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

    const logSearchInput = {
      query: grafanaQuery,
      start: options.start,
      end: options.end,
      limit: parseInt(options.limit, 10),
    };

    // Use the formatLogQuery function to display the query
    logger.info(formatLogQuery(logSearchInput));
    logger.info(`Formatted Grafana query: ${grafanaQuery}`);

    const grafanaClient = new GrafanaClient(grafanaCfg);
    const logs = await grafanaClient.fetchLogs({
      type: "logSearchInput",
      ...logSearchInput,
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
  throw error;
});
