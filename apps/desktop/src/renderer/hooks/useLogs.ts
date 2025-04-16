import { useEffect, useState } from "react";
import { DEFAULT_END_DATE, DEFAULT_START_DATE } from "../components/TimeRangePicker";
import api from "../services/api";
import { Log, LogQueryParams, LogsWithPagination, TimeRange } from "../types";

export function useLogs() {
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

  // Fetch logs with the given parameters
  const fetchLogs = async (params: LogQueryParams): Promise<void> => {
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
  };

  // Fetch logs with query
  const fetchLogsWithQuery = (query: string, customTimeRange?: TimeRange): void => {
    const params: LogQueryParams = {
      query: query,
      start: customTimeRange ? customTimeRange.start : timeRange.start,
      end: customTimeRange ? customTimeRange.end : timeRange.end,
      limit: queryLimit,
    };

    fetchLogs(params);
  };

  // Handle loading more logs (pagination)
  const handleLoadMoreLogs = (): void => {
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
  };

  // Handle time range changes
  const handleTimeRangeChange = (newTimeRange: TimeRange): void => {
    setTimeRange(newTimeRange);
    fetchLogsWithQuery(logQuery, newTimeRange);
  };

  // Initial fetch
  useEffect(() => {
    const params: LogQueryParams = {
      query: logQuery,
      start: timeRange.start,
      end: timeRange.end,
      limit: queryLimit,
    };

    fetchLogs(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  };
}
