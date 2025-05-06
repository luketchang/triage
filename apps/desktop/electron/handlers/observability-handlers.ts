import { ipcMain } from "electron";
import {
  FacetData,
  getObservabilityPlatform,
  IntegrationType,
  LogQueryParams,
  LogsWithPagination,
  TraceQueryParams,
  TracesWithPagination,
} from "../../src/renderer/src/types/index.js";

/**
 * Set up all IPC handlers related to observability (logs, traces)
 */
export function setupObservabilityHandlers(): void {
  console.info("Setting up observability handlers...");

  // Fetch logs based on query parameters
  ipcMain.handle(
    "observability:fetch-logs",
    async (_event: any, params: LogQueryParams): Promise<LogsWithPagination> => {
      try {
        console.info("Fetching logs with params:", params);

        // Get the configured observability platform
        const platformType =
          (process.env.OBSERVABILITY_PLATFORM as IntegrationType) || IntegrationType.DATADOG;

        // Get the observability platform implementation
        const platform = getObservabilityPlatform(platformType);

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
        console.error("Error fetching logs:", error);
        throw error;
      }
    }
  );

  // Get log facet values for a given time range
  ipcMain.handle(
    "observability:get-logs-facet-values",
    async (_event: any, start: string, end: string): Promise<FacetData[]> => {
      try {
        console.info("Getting log facet values for time range:", { start, end });

        // Get the configured observability platform
        const platformType =
          (process.env.OBSERVABILITY_PLATFORM as IntegrationType) || IntegrationType.DATADOG;

        // Get the observability platform implementation
        const platform = getObservabilityPlatform(platformType);

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
        console.error("Error getting log facet values:", error);
        throw error;
      }
    }
  );

  // Fetch traces based on query parameters
  ipcMain.handle(
    "observability:fetch-traces",
    async (_event: any, params: TraceQueryParams): Promise<TracesWithPagination> => {
      try {
        console.info("Fetching traces with params:", params);

        // Get the configured observability platform
        const platformType =
          (process.env.OBSERVABILITY_PLATFORM as IntegrationType) || IntegrationType.DATADOG;

        // Get the observability platform implementation
        const platform = getObservabilityPlatform(platformType);

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
        console.error("Error fetching traces:", error);
        throw error;
      }
    }
  );

  // Get span facet values for a given time range
  ipcMain.handle(
    "observability:get-spans-facet-values",
    async (_event: any, start: string, end: string): Promise<FacetData[]> => {
      try {
        console.info("Getting span facet values for time range:", { start, end });

        // Get the configured observability platform
        const platformType =
          (process.env.OBSERVABILITY_PLATFORM as IntegrationType) || IntegrationType.DATADOG;

        // Get the observability platform implementation
        const platform = getObservabilityPlatform(platformType);

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
        console.error("Error getting span facet values:", error);
        throw error;
      }
    }
  );

  console.info("All observability handlers registered.");
}

/**
 * Clean up resources used by observability handlers
 */
export function cleanupObservabilityHandlers(): void {
  // No specific cleanup needed currently
  console.info("Observability handlers cleanup complete.");
}
