import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_END_DATE, DEFAULT_START_DATE } from "../components/TimeRangePicker";
import api from "../services/api";
import { FacetData, Log, LogQueryParams, LogsWithPagination, TimeRange } from "../types";

interface UseLogsOptions {
  shouldFetch?: boolean;
}

export function useLogs(options: UseLogsOptions = {}) {
  const { shouldFetch = false } = options;
  const [logs, setLogs] = useState<Log[]>([]);
  const [logsWithPagination, setLogsWithPagination] = useState<LogsWithPagination | null>(null);
  const [logQuery, setLogQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: DEFAULT_START_DATE.toISOString(),
    end: DEFAULT_END_DATE.toISOString(),
  });
  const [pageCursor, setPageCursor] = useState<string | undefined>(undefined);
  const [queryLimit] = useState<number>(500);

  // Add state for facets
  const [facets, setFacets] = useState<FacetData[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<string[]>([
    "service",
    "level",
    "host",
    "environment",
  ]);
  const loadedFacetsForRange = useRef<string>("");

  // For tracking if we've done the initial load
  const initialLoadDone = useRef(false);

  // Fetch logs with the given parameters - memoize with useCallback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchLogs = useCallback(
    async (params: LogQueryParams): Promise<void> => {
      setIsLoading(true);

      try {
        console.info("Fetching logs with params:", params);
        const response = await api.fetchLogs(params);

        if (response && response.success && response.data) {
          let filteredLogs = response.data.logs || [];

          // Store the complete response data with pagination
          if (params.pageCursor) {
            // For pagination, merge with existing data since view is expanding
            if (logsWithPagination) {
              const updatedLogs = [...logsWithPagination.logs, ...filteredLogs];
              setLogsWithPagination({
                ...response.data,
                logs: updatedLogs,
              });
            } else {
              setLogsWithPagination(response.data);
            }
            // Update logs array for UI components
            setLogs((prev) => [...prev, ...filteredLogs]);
          } else {
            // For new queries, replace existing data
            setLogsWithPagination(response.data);
            setLogs(filteredLogs);
          }

          // Update the cursor for next page
          setPageCursor(response.data.pageCursorOrIndicator);
        } else {
          console.warn("Invalid response format from fetchLogs:", response);
          if (!params.pageCursor) {
            setLogs([]);
            setLogsWithPagination(null);
          }
        }
      } catch (error) {
        console.error("Error fetching logs:", error);
        if (!params.pageCursor) {
          setLogs([]);
          setLogsWithPagination(null);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [setIsLoading, setLogs, setLogsWithPagination, setPageCursor]
  );

  // Fetch logs with query
  const fetchLogsWithQuery = useCallback(
    (query: string, customTimeRange?: TimeRange): void => {
      const params: LogQueryParams = {
        query: query || "", // Default to empty string if query is undefined/null
        start: customTimeRange ? customTimeRange.start : timeRange.start,
        end: customTimeRange ? customTimeRange.end : timeRange.end,
        limit: queryLimit,
      };

      fetchLogs(params);
    },
    [fetchLogs, timeRange, queryLimit]
  );

  // Load facets for the current time range
  const loadFacets = useCallback(async () => {
    const rangeKey = `${timeRange.start}-${timeRange.end}`;

    // Only fetch facets if we haven't loaded them for this time range
    if (loadedFacetsForRange.current !== rangeKey) {
      try {
        const response = await api.getLogsFacetValues(timeRange.start, timeRange.end);

        if (
          response &&
          "data" in response &&
          response.success &&
          response.data &&
          response.data.length > 0
        ) {
          setFacets(response.data);
        } else if (Array.isArray(response) && response.length > 0) {
          setFacets(response);
        } else {
          console.info("No valid facet data received, using empty array");
          setFacets([]);
        }

        loadedFacetsForRange.current = rangeKey;
      } catch (error) {
        console.error("Error loading facets:", error);
        setFacets([]);
      }
    }
  }, [timeRange.start, timeRange.end]);

  // Handle time range changes
  const handleTimeRangeChange = useCallback(
    (newTimeRange: TimeRange): void => {
      // Update the time range state
      setTimeRange(newTimeRange);

      // Always load facets for the new time range
      loadFacets();

      // Fetch logs with the current query and new time range
      if (logQuery || shouldFetch) {
        fetchLogsWithQuery(logQuery, newTimeRange);
      }
    },
    [fetchLogsWithQuery, loadFacets, logQuery, shouldFetch]
  );

  // Handle loading more logs (pagination)
  const handleLoadMoreLogs = useCallback((): void => {
    if (pageCursor) {
      const params: LogQueryParams = {
        query: logQuery,
        start: timeRange.start,
        end: timeRange.end,
        limit: queryLimit,
        pageCursor: pageCursor,
      };

      fetchLogs(params);
    }
  }, [fetchLogs, logQuery, timeRange, queryLimit, pageCursor]);

  // Initial fetch only if shouldFetch is true
  useEffect(() => {
    // Only fetch on initial load (when initialLoadDone.current is false)
    // or when shouldFetch changes from false to true
    if (shouldFetch && !initialLoadDone.current) {
      const params: LogQueryParams = {
        query: "",
        start: timeRange.start,
        end: timeRange.end,
        limit: queryLimit,
        pageCursor: undefined,
      };

      fetchLogs(params);

      // Load facets for the initial time range
      loadFacets();

      // Mark initial load as done
      initialLoadDone.current = true;
    }
  }, [shouldFetch, fetchLogs, loadFacets, timeRange, queryLimit]);

  return {
    logs,
    logsWithPagination,
    logQuery,
    setLogQuery,
    isLoading,
    timeRange,
    fetchLogsWithQuery,
    handleLoadMoreLogs,
    handleTimeRangeChange,
    setLogs,
    setLogsWithPagination,
    setIsLoading,
    setPageCursor,
    pageCursor,
    fetchLogs,
    setTimeRange,
    // Return facet state
    facets,
    selectedFacets,
    setSelectedFacets,
    loadFacets,
  };
}
