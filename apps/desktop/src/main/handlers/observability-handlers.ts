import { ObservabilityConfigStore } from "@triage/observability";
import { ipcMain } from "electron";
import { logger } from "@triage/common";
import {
  FacetData,
  getObservabilityPlatform,
  LogQueryParams,
  LogsWithPagination,
  TraceQueryParams,
  TracesWithPagination,
} from "../../renderer/src/types/index.js";

/**
 * Set up all IPC handlers related to observability (logs, traces)
 */
export function setupObservabilityHandlers(observabilityCfgStore: ObservabilityConfigStore): void {
  logger.info("OBSERVABILITY_HANDLERS: Entered setupObservabilityHandlers (via passed logger).");
  logger.info("Setting up observability handlers... (via passed logger)");

  // Fetch logs based on query parameters
  ipcMain.handle(
    "observability:fetch-logs",
    async (_event: any, params: LogQueryParams): Promise<LogsWithPagination> => {
      try {
        logger.info("Fetching logs with params (via passed logger): " + JSON.stringify(params));

        const observabilityCfg = await observabilityCfgStore.getValues();
        const platform = getObservabilityPlatform(observabilityCfg);

        // Call the real platform API
        const result = await platform.fetchLogs({
          query: params.query || "",
          start: params.start,
          end: params.end,
          limit: params.limit || 500,
          pageCursor: params.pageCursor,
        });

        return result;
      } catch (error) {
        logger.info("Error fetching logs (via passed logger): " + String(error)); // Use logger.info for errors
        throw error;
      }
    }
  );

  // Get log facet values for a given time range
  ipcMain.handle(
    "observability:get-logs-facet-values",
    async (_event: any, start: string, end: string): Promise<FacetData[]> => {
      try {
        logger.info(
          "Getting log facet values for time range (via passed logger): " +
            JSON.stringify({ start, end })
        );

        const observabilityCfg = await observabilityCfgStore.getValues();
        const platform = getObservabilityPlatform(observabilityCfg);

        // Call the real platform API
        const logFacetsMap = await platform.getLogsFacetValues(start, end);

        // Convert the Map<string, string[]> to FacetData[] format
        const facetsArray = Array.from(logFacetsMap.entries()).map(([name, values]) => {
          // Create counts array with same length as values (with placeholder values of 1)
          const counts = new Array(values.length).fill(1);
          return { name, values, counts };
        });

        return facetsArray;
      } catch (error) {
        logger.info("Error getting log facet values (via passed logger): " + String(error)); // Use logger.info for errors
        throw error;
      }
    }
  );

  // Fetch traces based on query parameters
  ipcMain.handle(
    "observability:fetch-traces",
    async (_event: any, params: TraceQueryParams): Promise<TracesWithPagination> => {
      try {
        logger.info("Fetching traces with params (via passed logger): " + JSON.stringify(params));

        const observabilityCfg = await observabilityCfgStore.getValues();
        const platform = getObservabilityPlatform(observabilityCfg);

        // Call the real platform API (assuming the method exists)
        const result = await platform.fetchTraces({
          query: params.query || "",
          start: params.start,
          end: params.end,
          limit: params.limit || 1000,
          pageCursor: params.pageCursor,
        });

        return result;
      } catch (error) {
        logger.info("Error fetching traces (via passed logger): " + String(error)); // Use logger.info for errors
        throw error;
      }
    }
  );

  // Get span facet values for a given time range
  ipcMain.handle(
    "observability:get-spans-facet-values",
    async (_event: any, start: string, end: string): Promise<FacetData[]> => {
      try {
        logger.info(
          "Getting span facet values for time range (via passed logger): " +
            JSON.stringify({ start, end })
        );

        const observabilityCfg = await observabilityCfgStore.getValues();
        const platform = getObservabilityPlatform(observabilityCfg);

        // Call the real platform API (assuming the method exists)
        const spanFacetsMap = await platform.getSpansFacetValues(start, end);

        // Convert the Map<string, string[]> to FacetData[] format
        const facetsArray = Array.from(spanFacetsMap.entries()).map(([name, values]) => {
          // Create counts array with same length as values (with placeholder values of 1)
          const counts = new Array(values.length).fill(1);
          return { name, values, counts };
        });

        return facetsArray;
      } catch (error) {
        logger.info("Error getting span facet values (via passed logger): " + String(error)); // Use logger.info for errors
        throw error;
      }
    }
  );

  logger.info("All observability handlers registered. (via passed logger)");
}

/**
 * Clean up resources used by observability handlers
 */
export function cleanupObservabilityHandlers(): void {
  logger.info("OBSERVABILITY_HANDLERS: cleanupObservabilityHandlers called (via passed logger).");
  // No specific cleanup needed currently
  logger.info("Observability handlers cleanup complete. (via passed logger)");
}
