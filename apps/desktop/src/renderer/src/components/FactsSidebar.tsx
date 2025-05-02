import React, { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import LogsView from "../features/LogsView";
import api from "../services/api";
import {
  CodePostprocessingFact,
  FacetData,
  Log,
  LogPostprocessingFact,
  LogsWithPagination,
  TimeRange,
} from "../types";

interface FactsSidebarProps {
  logFacts: LogPostprocessingFact[];
  codeFacts: CodePostprocessingFact[];
}

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const SlideOver: React.FC<SlideOverProps> = ({ isOpen, onClose, children }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    // Wait for animation to complete before fully closing
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300); // Match animation duration
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div className="facts-slideover-container">
      <div className="facts-slideover-backdrop" onClick={handleClose}></div>
      <div className={`facts-slideover ${isClosing ? "closing" : ""}`}>
        <div className="facts-slideover-header">
          <button onClick={handleClose} className="facts-slideover-close-button">
            &larr; Back
          </button>
        </div>
        <div className="facts-slideover-content">{children}</div>
      </div>
    </div>
  );
};

const FactsSidebar: React.FC<FactsSidebarProps> = ({ logFacts, codeFacts }) => {
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [selectedLogFact, setSelectedLogFact] = useState<LogPostprocessingFact | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [logsWithPagination, setLogsWithPagination] = useState<LogsWithPagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageCursor, setPageCursor] = useState<string | undefined>(undefined);
  const [logQuery, setLogQuery] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: "",
    end: "",
  });
  const [facets, setFacets] = useState<FacetData[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<string[]>([
    "service",
    "level",
    "host",
    "environment",
  ]);
  const loadedFacetsForRange = React.useRef<string>("");

  // Add function to load facets - move it before useEffect
  const loadFacets = useCallback(async () => {
    if (!timeRange.start || !timeRange.end) return;

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
  }, [timeRange]);

  // Fetch logs when a log fact is selected

  useEffect(() => {
    if (selectedLogFact && slideOverOpen) {
      // Only fetch logs and facets on first open
      fetchLogsForFact(selectedLogFact);

      // Load facets after fetchLogsForFact, which also sets the timeRange
      const timeRangeKey = `${selectedLogFact.start}-${selectedLogFact.end}`;
      if (loadedFacetsForRange.current !== timeRangeKey) {
        loadFacets();
      }
    }
  }, [selectedLogFact, slideOverOpen]);

  const fetchLogsForFact = async (fact: LogPostprocessingFact) => {
    try {
      setIsLoading(true);

      // Set the query and time range from the fact - do this first to update UI state
      setLogQuery(fact.query);

      // Set time range without triggering more effects
      const newTimeRange = {
        start: fact.start,
        end: fact.end,
      };
      setTimeRange(newTimeRange);

      // Fetch logs using the API
      const response = await api.fetchLogs({
        query: fact.query,
        start: fact.start,
        end: fact.end,
        limit: fact.limit || 100,
        pageCursor: fact.pageCursor || undefined,
      });

      if (response.success && response.data) {
        setLogs(response.data.logs);
        setLogsWithPagination({
          logs: response.data.logs,
          pageCursorOrIndicator: response.data.pageCursorOrIndicator,
        });
        setPageCursor(response.data.pageCursorOrIndicator);
      } else {
        console.error("Error fetching logs:", response);
        setLogs([]);
        setLogsWithPagination(null);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      setLogs([]);
      setLogsWithPagination(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogFactClick = (fact: LogPostprocessingFact) => {
    setSelectedLogFact(fact);
    setSlideOverOpen(true);
  };

  const handleCloseSlideOver = () => {
    setSlideOverOpen(false);
  };

  // Allow executing new log queries
  const handleQuerySubmit = async (query: string) => {
    if (!selectedLogFact) return;

    try {
      setIsLoading(true);

      // Use the current timeRange state
      const response = await api.fetchLogs({
        query: query,
        start: timeRange.start,
        end: timeRange.end,
        limit: selectedLogFact.limit || 100,
        pageCursor: undefined, // Reset pagination on new query
      });

      if (response.success && response.data) {
        setLogs(response.data.logs);
        setLogsWithPagination({
          logs: response.data.logs,
          pageCursorOrIndicator: response.data.pageCursorOrIndicator,
        });
        setPageCursor(response.data.pageCursorOrIndicator);
      } else {
        console.error("Error fetching logs:", response);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle loading more logs
  const handleLoadMore = async () => {
    if (!selectedLogFact || !pageCursor) return;

    try {
      setIsLoading(true);

      const response = await api.fetchLogs({
        query: logQuery,
        start: timeRange.start,
        end: timeRange.end,
        limit: selectedLogFact.limit || 100,
        pageCursor: pageCursor,
      });

      if (response.success && response.data) {
        setLogs([...logs, ...response.data.logs]);
        setLogsWithPagination({
          logs: [...logs, ...response.data.logs],
          pageCursorOrIndicator: response.data.pageCursorOrIndicator,
        });
        setPageCursor(response.data.pageCursorOrIndicator);
      } else {
        console.error("Error fetching more logs:", response);
      }
    } catch (error) {
      console.error("Error fetching more logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeRangeChange = (newTimeRange: TimeRange) => {
    // First update the time range state
    setTimeRange(newTimeRange);

    // Fetch logs with new time range, but keep the current query
    if (selectedLogFact) {
      try {
        setIsLoading(true);

        // Use current logQuery instead of selectedLogFact.query to preserve any user edits
        api
          .fetchLogs({
            query: logQuery, // Use current query, not the original fact.query
            start: newTimeRange.start,
            end: newTimeRange.end,
            limit: selectedLogFact.limit || 100,
            pageCursor: undefined, // Reset pagination on time range change
          })
          .then((response) => {
            if (response.success && response.data) {
              setLogs(response.data.logs);
              setLogsWithPagination({
                logs: response.data.logs,
                pageCursorOrIndicator: response.data.pageCursorOrIndicator,
              });
              setPageCursor(response.data.pageCursorOrIndicator);
            } else {
              console.error("Error fetching logs:", response);
            }
            setIsLoading(false);
          })
          .catch((error) => {
            console.error("Error fetching logs:", error);
            setIsLoading(false);
          });

        // Only load facets once per time range (handled by loadFacets function)
        loadFacets();
      } catch (error) {
        console.error("Error in handleTimeRangeChange:", error);
        setIsLoading(false);
      }
    }
  };

  const renderLogFact = (fact: LogPostprocessingFact, index: number) => {
    return (
      <div key={`log-fact-${index}`} className="fact-item log-fact">
        <div className="fact-header">
          <h3 className="fact-title">{fact.title}</h3>
          <span className="fact-type">LOG</span>
        </div>
        <div className="fact-content">
          <p className="fact-text">{fact.fact}</p>
        </div>
        <button className="view-logs-button" onClick={() => handleLogFactClick(fact)}>
          View Logs
        </button>
      </div>
    );
  };

  const renderCodeFact = (fact: CodePostprocessingFact, index: number) => {
    return (
      <div key={`code-fact-${index}`} className="fact-item code-fact">
        <div className="fact-header">
          <h3 className="fact-title">{fact.title}</h3>
          <span className="fact-type">CODE</span>
        </div>
        <div className="fact-content">
          <p className="fact-text">{fact.fact}</p>
          <div className="fact-path">{fact.filepath}</div>
          <div className="code-block">
            <ReactMarkdown>{`\`\`\`\n${fact.codeBlock}\n\`\`\``}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  };

  const renderLogsSlideOver = () => {
    if (!selectedLogFact) return null;

    return (
      <LogsView
        logs={logs}
        logsWithPagination={logsWithPagination}
        logQuery={logQuery}
        timeRange={timeRange}
        isLoading={isLoading}
        setLogQuery={setLogQuery}
        onTimeRangeChange={handleTimeRangeChange}
        onQuerySubmit={handleQuerySubmit}
        onLoadMore={handleLoadMore}
        facets={facets}
        selectedFacets={selectedFacets}
        setSelectedFacets={setSelectedFacets}
      />
    );
  };

  // Only render the sidebar if there are facts to show
  if (logFacts.length === 0 && codeFacts.length === 0) {
    return null;
  }

  return (
    <div className="facts-sidebar">
      <div className="facts-header">
        <h2 className="facts-title">Facts</h2>
      </div>
      <div className="facts-content">
        {logFacts.map(renderLogFact)}
        {codeFacts.map(renderCodeFact)}
      </div>

      <SlideOver isOpen={slideOverOpen} onClose={handleCloseSlideOver}>
        {renderLogsSlideOver()}
      </SlideOver>
    </div>
  );
};

export default FactsSidebar;
