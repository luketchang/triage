import { useEffect, useState } from "react";
import { DEFAULT_END_DATE, DEFAULT_START_DATE } from "../components/TimeRangePicker";
import api from "../services/api";
import { TimeRange, Trace, TraceQueryParams, UITrace } from "../types";

// Mock data for service colors
const TRACE_COLORS = [
  "#4D54EB", // blue
  "#9B5CE5", // purple
  "#00A67E", // green
  "#F28B44", // orange
  "#E94C89", // pink
  "#00B9F2", // light blue
  "#708798", // slate
  "#F76464", // red
];

export function useTraces() {
  const [traces, setTraces] = useState<UITrace[]>([]);
  const [traceQuery, setTraceQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: DEFAULT_START_DATE.toISOString(),
    end: DEFAULT_END_DATE.toISOString(),
  });
  const [pageCursor, setPageCursor] = useState<string | undefined>(undefined);
  const [selectedTrace, setSelectedTrace] = useState<UITrace | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<any | null>(null);
  const [facets, setFacets] = useState<any[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<string[]>([
    "service",
    "resource",
    "http.status_code",
    "environment",
  ]);
  const [queryLimit] = useState<number>(20);

  // Process traces to add UI properties like colors
  const processTracesForUI = (traces: Trace[]): UITrace[] => {
    return traces.map((trace) => {
      // Assign colors to services in the breakdown
      const serviceBreakdown = trace.serviceBreakdown.map((service, index) => ({
        ...service,
        color: TRACE_COLORS[index % TRACE_COLORS.length],
      }));

      return {
        ...trace,
        serviceBreakdown,
      };
    });
  };

  // Fetch traces with the given parameters
  const fetchTraces = async (params: TraceQueryParams): Promise<void> => {
    setIsLoading(true);

    try {
      console.info("Fetching traces with params:", params);
      const response = await api.fetchTraces(params);

      if (response && response.success && response.data) {
        // Process trace data to add UI enhancements like colors
        const processedTraces = processTracesForUI(response.data.traces);

        // Update traces state
        if (params.pageCursor) {
          setTraces((prev) => [...prev, ...processedTraces]);
        } else {
          setTraces(processedTraces);
        }

        // Update the cursor for next page
        setPageCursor(response.data.pageCursorOrIndicator);

        // Clear selected trace if not in new results
        if (selectedTrace) {
          const stillExists = processedTraces.some(
            (trace) => trace.traceId === selectedTrace.traceId
          );
          if (!stillExists) {
            setSelectedTrace(null);
            setSelectedSpan(null);
          }
        }
      } else {
        console.warn("Invalid response format from fetchTraces:", response);
        if (!params.pageCursor) {
          setTraces([]);
        }
      }
    } catch (error) {
      console.error("Error fetching traces:", error);
      if (!params.pageCursor) {
        setTraces([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch traces with query
  const fetchTracesWithQuery = (query: string, customTimeRange?: TimeRange): void => {
    const params: TraceQueryParams = {
      query: query,
      start: customTimeRange ? customTimeRange.start : timeRange.start,
      end: customTimeRange ? customTimeRange.end : timeRange.end,
      limit: queryLimit,
    };

    fetchTraces(params);
  };

  // Handle loading more traces (pagination)
  const handleLoadMoreTraces = (): void => {
    if (pageCursor) {
      const params: TraceQueryParams = {
        query: traceQuery,
        start: timeRange.start,
        end: timeRange.end,
        limit: queryLimit,
        pageCursor: pageCursor,
      };

      fetchTraces(params);
    }
  };

  // Handle time range changes
  const handleTimeRangeChange = (newTimeRange: TimeRange): void => {
    setTimeRange(newTimeRange);
    fetchTracesWithQuery(traceQuery, newTimeRange);
  };

  // Handle trace selection
  const handleTraceSelect = (trace: UITrace | null) => {
    setSelectedTrace(trace);
    if (trace) {
      setSelectedSpan(trace.displayTrace.rootSpan); // Select the root span by default
    } else {
      setSelectedSpan(null);
    }
  };

  // Handle span selection
  const handleSpanSelect = (span: any) => {
    setSelectedSpan(span);
  };

  // Load facets when the time range changes
  useEffect(() => {
    const loadFacets = async () => {
      try {
        const response = await api.getSpansFacetValues(timeRange.start, timeRange.end);
        if (Array.isArray(response)) {
          setFacets(response);
        } else if (response && response.success && response.data && response.data.length > 0) {
          setFacets(response.data);
        } else {
          console.info("No valid facet data received, using empty array");
          setFacets([]);
        }
      } catch (error) {
        console.error("Error loading facets:", error);
        setFacets([]);
      }
    };

    loadFacets();
  }, [timeRange.start, timeRange.end]);

  // Initial fetch
  useEffect(() => {
    const params: TraceQueryParams = {
      query: traceQuery,
      start: timeRange.start,
      end: timeRange.end,
      limit: queryLimit,
    };

    fetchTraces(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    traces,
    traceQuery,
    setTraceQuery,
    isLoading,
    timeRange,
    fetchTracesWithQuery,
    handleLoadMoreTraces,
    handleTimeRangeChange,
    facets,
    selectedFacets,
    setSelectedFacets,
    selectedTrace,
    selectedSpan,
    handleTraceSelect,
    handleSpanSelect,
    pageCursor,
    setTraces,
    setIsLoading,
    setPageCursor,
    setSelectedSpan,
    setTimeRange,
    processTracesForUI,
  };
}
