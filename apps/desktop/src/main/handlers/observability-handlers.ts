import { getLogger } from "@triage/common";
import { ObservabilityConfigStore } from "@triage/observability";
import { ipcMain } from "electron";
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
  const logger = getLogger();
  logger.info("Setting up observability handlers...");

  // Fetch logs based on query parameters
  ipcMain.handle(
    "observability:fetch-logs",
    async (_event: any, params: LogQueryParams): Promise<LogsWithPagination> => {
      try {
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
        logger.error("Error fetching logs:", error);
        throw error;
      }
    }
  );

  // Get log facet values for a given time range
  ipcMain.handle(
    "observability:get-logs-facet-values",
    async (_event: any, start: string, end: string): Promise<FacetData[]> => {
      try {
        const observabilityCfg = await observabilityCfgStore.getValues();
        const platform = getObservabilityPlatform(observabilityCfg);

        // Call the real platform API
        logger.info("Getting log facet values for time range:", { start, end });
        const logFacetsMap = await platform.getLogsFacetValues(start, end);

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
  ipcMain.handle(
    "observability:fetch-traces",
    async (_event: any, params: TraceQueryParams): Promise<TracesWithPagination> => {
      try {
        const observabilityCfg = await observabilityCfgStore.getValues();
        const platform = getObservabilityPlatform(observabilityCfg);

        // Call the real platform API (assuming the method exists)
        logger.info("Fetching traces for time range:", { start: params.start, end: params.end });
        const result = await platform.fetchTraces({
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
  ipcMain.handle(
    "observability:get-spans-facet-values",
    async (_event: any, start: string, end: string): Promise<FacetData[]> => {
      try {
        const observabilityCfg = await observabilityCfgStore.getValues();
        const platform = getObservabilityPlatform(observabilityCfg);

        // Call the real platform API (assuming the method exists)
        logger.info("Getting span facet values for time range:", { start, end });
        const spanFacetsMap = await platform.getSpansFacetValues(start, end);

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

  logger.info("All observability handlers registered.");
}

/**
 * Clean up resources used by observability handlers
 */
export function cleanupObservabilityHandlers(): void {
  const logger = getLogger();
  // Remove all handlers
  ipcMain.removeHandler("observability:fetch-logs");
  ipcMain.removeHandler("observability:get-logs-facet-values");
  ipcMain.removeHandler("observability:fetch-traces");
  ipcMain.removeHandler("observability:get-spans-facet-values");

  logger.info("Observability handlers cleanup complete.");
}
