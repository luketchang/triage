import { logger } from "@triage/common";
import {
  DataIntegrationsConfigStore,
  GetSentryEventInput,
  SentryClient,
  SentryEvent,
  getLogsClient,
  getTracesClient,
} from "@triage/data-integrations";
import { ipcMain } from "electron";
import {
  FacetData,
  LogSearchInput,
  LogsWithPagination,
  TraceSearchInput,
  TracesWithPagination,
} from "../../renderer/src/types/index.js";
import { registerHandler } from "./register-util.js";

/**
 * Set up all IPC handlers related to data integrations (logs, traces, sentry)
 */
export function setupDataIntegrationHandlers(
  dataIntegrationsCfgStore: DataIntegrationsConfigStore
): void {
  logger.info("Setting up data integration handlers...");

  // Fetch logs based on query parameters
  registerHandler(
    "logs:fetch",
    async (_event: any, params: LogSearchInput): Promise<LogsWithPagination> => {
      try {
        const dataIntegrationsCfg = await dataIntegrationsCfgStore.getValues();
        const logsClient = getLogsClient(dataIntegrationsCfg);

        // Call the real client API
        const result = await logsClient.fetchLogs({
          type: "logSearchInput",
          query: params.query || "",
          start: params.start,
          end: params.end,
          limit: params.limit || 500,
          pageCursor: params.pageCursor,
        });

        return result;
      } catch (error) {
        logger.error("Error fetching logs:", error);
        throw error;
      }
    }
  );

  // Get log facet values for a given time range
  registerHandler(
    "logs:get-facet-values",
    async (_event: any, start: string, end: string): Promise<FacetData[]> => {
      try {
        const dataIntegrationsCfg = await dataIntegrationsCfgStore.getValues();
        const logsClient = getLogsClient(dataIntegrationsCfg);

        // Call the real client API
        logger.info("Getting log facet values for time range:", { start, end });
        const logFacetsMap = await logsClient.getLogsFacetValues(start, end);

        // Convert the Map<string, string[]> to FacetData[] format
        const facetsArray = Array.from(logFacetsMap.entries()).map(([name, values]) => {
          // Create counts array with same length as values (with placeholder values of 1)
          const counts = new Array(values.length).fill(1);
          return { name, values, counts };
        });

        return facetsArray;
      } catch (error) {
        logger.error("Error getting log facet values:", error);
        throw error;
      }
    }
  );

  // Fetch traces based on query parameters
  registerHandler(
    "traces:fetch",
    async (_event: any, params: TraceSearchInput): Promise<TracesWithPagination> => {
      try {
        const dataIntegrationsCfg = await dataIntegrationsCfgStore.getValues();
        const tracesClient = getTracesClient(dataIntegrationsCfg);

        // Call the real client API
        logger.info("Fetching traces for time range:", { start: params.start, end: params.end });
        const result = await tracesClient.fetchTraces({
          type: "traceSearchInput",
          query: params.query || "",
          start: params.start,
          end: params.end,
          limit: params.limit || 1000,
          pageCursor: params.pageCursor,
        });

        return result;
      } catch (error) {
        logger.error("Error fetching traces:", error);
        throw error;
      }
    }
  );

  // Get span facet values for a given time range
  registerHandler(
    "traces:get-spans-facet-values",
    async (_event: any, start: string, end: string): Promise<FacetData[]> => {
      try {
        const dataIntegrationsCfg = await dataIntegrationsCfgStore.getValues();
        const tracesClient = getTracesClient(dataIntegrationsCfg);

        // Call the real client API
        logger.info("Getting span facet values for time range:", { start, end });
        const spanFacetsMap = await tracesClient.getSpansFacetValues(start, end);

        // Convert the Map<string, string[]> to FacetData[] format
        const facetsArray = Array.from(spanFacetsMap.entries()).map(([name, values]) => {
          // Create counts array with same length as values (with placeholder values of 1)
          const counts = new Array(values.length).fill(1);
          return { name, values, counts };
        });

        return facetsArray;
      } catch (error) {
        logger.error("Error getting span facet values:", error);
        throw error;
      }
    }
  );

  // Fetch Sentry event by specifier
  registerHandler(
    "sentry:fetch-event",
    async (_event: any, params: GetSentryEventInput): Promise<SentryEvent> => {
      try {
        const dataIntegrationsCfg = await dataIntegrationsCfgStore.getValues();

        if (!dataIntegrationsCfg.sentry?.authToken) {
          throw new Error("Sentry auth token not configured");
        }

        const client = new SentryClient(dataIntegrationsCfg.sentry.authToken);

        // Call the client API to fetch the event
        logger.info(`Fetching Sentry event for org ${params.orgSlug}, issue ${params.issueId}`);
        const result = await client.getEventForIssue(params);

        return result;
      } catch (error) {
        logger.error("Error fetching Sentry event:", error);
        throw error;
      }
    }
  );

  logger.info("All data integration handlers registered.");
}

/**
 * Clean up resources used by data integration handlers
 */
export function cleanupDataIntegrationHandlers(): void {
  // Remove all handlers
  ipcMain.removeHandler("logs:fetch");
  ipcMain.removeHandler("logs:get-facet-values");
  ipcMain.removeHandler("traces:fetch");
  ipcMain.removeHandler("traces:get-spans-facet-values");
  ipcMain.removeHandler("sentry:fetch-event");

  logger.info("Data integration handlers cleanup complete.");
}
