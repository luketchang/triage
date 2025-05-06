import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_END_DATE, DEFAULT_START_DATE } from "../components/TimeRangePicker";
import api from "../services/api";
import { FacetData, Span, TimeRange, Trace, TraceQueryParams, UITrace } from "../types";

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

interface UseTracesOptions {
  shouldFetch?: boolean;
}

export function useTraces(options: UseTracesOptions = {}) {
  const { shouldFetch = false } = options;
  const [traces, setTraces] = useState<UITrace[]>([]);
  const [traceQuery, setTraceQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: DEFAULT_START_DATE.toISOString(),
    end: DEFAULT_END_DATE.toISOString(),
  });
  const [pageCursor, setPageCursor] = useState<string | undefined>(undefined);
  const [selectedTrace, setSelectedTrace] = useState<UITrace | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [facets, setFacets] = useState<FacetData[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<string[]>([
    "service",
    "resource",
    "http.status_code",
    "environment",
  ]);
  const [queryLimit] = useState<number>(500);
  const loadedFacetsForRange = useRef<string>("");

  // Process traces to add UI properties like colors
  const processTracesForUI = useCallback((traces: Trace[]): UITrace[] => {
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
  }, []);

  // Function to fetch traces from API
  const fetchTraces = useCallback(
    async (params: TraceQueryParams): Promise<void> => {
      setIsLoading(true);

      try {
        console.info("Fetching traces with params:", params);
        const data = await api.fetchTraces(params);

        if (data) {
          // Process trace data to add UI enhancements like colors
          const processedTraces = processTracesForUI(data.traces);

          // Update traces state
          if (params.pageCursor) {
            setTraces((prev) => [...prev, ...processedTraces]);
          } else {
            setTraces(processedTraces);
          }

          // Update the cursor for next page
          setPageCursor(data.pageCursorOrIndicator);

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
          console.warn("Invalid response format from fetchTraces:", data);
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
    },
    [setIsLoading, setTraces, setPageCursor, processTracesForUI, selectedTrace]
  );

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
  };

  // Handle trace selection
  const handleTraceSelect = (trace: UITrace | null) => {
    setSelectedTrace(trace);
    if (trace) {
      // Cast the DisplaySpan to Span since they're structurally compatible for our needs
      setSelectedSpan(trace.displayTrace.rootSpan as unknown as Span);
    } else {
      setSelectedSpan(null);
    }
  };

  // Handle span selection
  const handleSpanSelect = (span: Span) => {
    setSelectedSpan(span);
  };

  // Combined effect for time range changes and initial load
  useEffect(() => {
    // Only run if shouldFetch is true
    if (shouldFetch) {
      const loadData = async () => {
        setIsLoading(true);
        const rangeKey = `${timeRange.start}-${timeRange.end}`;

        try {
          // Only fetch facets if we haven't loaded them for this time range
          if (loadedFacetsForRange.current !== rangeKey) {
            const data = await api.getSpansFacetValues(timeRange.start, timeRange.end);
            if (data && data.length > 0) {
              setFacets(data);
            } else {
              console.info("No valid facet data received, using empty array");
              setFacets([]);
            }
            loadedFacetsForRange.current = rangeKey;
          }

          // Always fetch traces for the current time range
          const params: TraceQueryParams = {
            query: traceQuery,
            start: timeRange.start,
            end: timeRange.end,
            limit: queryLimit,
          };
          await fetchTraces(params);
        } catch (error) {
          console.error("Error loading data:", error);
          setFacets([]);
          setTraces([]);
        } finally {
          setIsLoading(false);
        }
      };

      loadData();
    }
  }, [timeRange.start, timeRange.end, traceQuery, fetchTraces, queryLimit, shouldFetch]);

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
