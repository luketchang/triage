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

const styles = {
  factsSidebar: {
    width: "100%",
    height: "100%",
    boxSizing: "border-box" as const,
    display: "flex",
    flexDirection: "column" as const,
  },
  factsHeader: {
    padding: "14px 0",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    marginBottom: "20px",
  },
  factsTitle: {
    fontSize: "22px",
    fontWeight: "600" as const,
    margin: 0,
    color: "#fff",
  },
  factsContent: {
    overflowY: "auto" as const,
    overflowX: "hidden" as const,
    flex: "1 1 auto",
    width: "100%",
    padding: "0 6px 0 0",
  },
  factItem: {
    marginBottom: "28px",
    padding: "18px",
    borderRadius: "8px",
    backgroundColor: "rgba(255,255,255,0.05)",
    width: "100%",
    boxSizing: "border-box" as const,
    overflow: "hidden",
    wordBreak: "break-word" as const,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  logFact: {
    borderLeft: "5px solid #3498db",
  },
  codeFact: {
    borderLeft: "5px solid #2ecc71",
  },
  factHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
    paddingBottom: "10px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  factTitle: {
    fontSize: "17px",
    fontWeight: "600" as const,
    margin: 0,
    color: "#fff",
  },
  factType: {
    fontSize: "12px",
    padding: "3px 10px",
    borderRadius: "4px",
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#ccc",
  },
  factContent: {
    color: "#ddd",
    fontSize: "14px",
    lineHeight: "1.6",
  },
  factText: {
    margin: "0 0 14px 0",
    wordBreak: "break-word" as const,
  },
  factPath: {
    fontSize: "13px",
    color: "#999",
    padding: "8px 0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    borderTop: "1px solid rgba(255,255,255,0.05)",
    marginTop: "10px",
  },
  codeBlock: {
    padding: "4px",
    marginTop: "12px",
    width: "100%",
    overflow: "auto",
    maxHeight: "280px",
    borderRadius: "6px",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  viewLogsButton: {
    marginTop: "18px",
    padding: "8px 16px",
    backgroundColor: "rgba(52, 152, 219, 0.2)",
    color: "#3498db",
    border: "1px solid #3498db",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500" as const,
    transition: "all 0.2s ease",
  },
};

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
      <div key={`log-fact-${index}`} style={{ ...styles.factItem, ...styles.logFact }}>
        <div style={styles.factHeader}>
          <h3 style={styles.factTitle}>{fact.title}</h3>
          <span style={styles.factType}>LOG</span>
        </div>
        <div style={styles.factContent}>
          <p style={styles.factText}>{fact.fact}</p>
        </div>
        <button
          style={styles.viewLogsButton}
          onClick={() => handleLogFactClick(fact)}
          onMouseOver={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.backgroundColor = "rgba(52, 152, 219, 0.3)";
          }}
          onMouseOut={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.backgroundColor = "rgba(52, 152, 219, 0.2)";
          }}
        >
          View Logs
        </button>
      </div>
    );
  };

  const renderCodeFact = (fact: CodePostprocessingFact, index: number) => {
    return (
      <div key={`code-fact-${index}`} style={{ ...styles.factItem, ...styles.codeFact }}>
        <div style={styles.factHeader}>
          <h3 style={styles.factTitle}>{fact.title}</h3>
          <span style={styles.factType}>CODE</span>
        </div>
        <div style={styles.factContent}>
          <p style={styles.factText}>{fact.fact}</p>
          <div style={styles.factPath}>{fact.filepath}</div>
          <div style={styles.codeBlock}>
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
        setLogsWithPagination={setLogsWithPagination}
      />
    );
  };

  // Only render the sidebar if there are facts to show
  if (logFacts.length === 0 && codeFacts.length === 0) {
    return null;
  }

  return (
    <div style={styles.factsSidebar}>
      <div style={styles.factsHeader}>
        <h2 style={styles.factsTitle}>Facts</h2>
      </div>
      <div style={styles.factsContent}>
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
