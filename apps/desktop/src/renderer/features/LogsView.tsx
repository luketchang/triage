import React, { useEffect, useState } from "react";
import SearchBar from "../components/SearchBar";
import TimeRangePicker from "../components/TimeRangePicker";
import { Artifact, FacetData, Log, LogsWithPagination, TimeRange } from "../types";
import { formatDate } from "../utils/formatters";

interface LogsViewProps {
  logs: Log[];
  logsWithPagination?: LogsWithPagination | null;
  logQuery: string;
  setLogQuery: (query: string) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  isLoading: boolean;
  onQuerySubmit: (query: string) => void;
  onLoadMore: () => void;
  selectedArtifact?: Artifact | null;
  setLogs?: (logs: Log[]) => void;
  setIsLoading?: (isLoading: boolean) => void;
  setPageCursor?: (cursor: string | undefined) => void;
  setTimeRange?: (timeRange: TimeRange) => void;
  facets: FacetData[];
  selectedFacets: string[];
  setSelectedFacets: React.Dispatch<React.SetStateAction<string[]>>;
  setLogsWithPagination?: (logsWithPagination: LogsWithPagination | null) => void;
}

const LogsView: React.FC<LogsViewProps> = ({
  logs,
  logsWithPagination,
  logQuery,
  timeRange,
  isLoading,
  setLogQuery,
  onTimeRangeChange,
  onQuerySubmit,
  onLoadMore,
  selectedArtifact,
  setLogs,
  setIsLoading,
  setPageCursor,
  setTimeRange,
  facets,
  selectedFacets,
  setSelectedFacets,
  setLogsWithPagination: _setLogsWithPagination,
}) => {
  // Component-specific state
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);

  // Add an event listener for the Escape key to close log details
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedLog) {
          setSelectedLog(null);
        }
      }
    };

    // Add the event listener
    window.addEventListener("keydown", handleKeyDown);

    // Clean up the event listener when component unmounts
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedLog]);

  // Effect to handle the selectedArtifact changes
  useEffect(() => {
    if (
      selectedArtifact &&
      selectedArtifact.type === "log" &&
      selectedArtifact.data &&
      selectedArtifact.data.input
    ) {
      const searchInput = selectedArtifact.data.input;

      // Update query through props
      setLogQuery(searchInput.query);

      // Handle the results if they exist - we want to do this FIRST
      if (selectedArtifact.data.results) {
        // For results that are objects (LogsWithPagination)
        if (
          typeof selectedArtifact.data.results === "object" &&
          selectedArtifact.data.results !== null
        ) {
          // Update logs directly from the artifact data
          if (
            "logs" in selectedArtifact.data.results &&
            Array.isArray(selectedArtifact.data.results.logs) &&
            setLogs
          ) {
            // Mark as loading while we update everything
            if (setIsLoading) {
              setIsLoading(true);
            }

            // Update logs from the artifact data
            setLogs(selectedArtifact.data.results.logs);

            // Update cursor for pagination if available
            if ("pageCursorOrIndicator" in selectedArtifact.data.results && setPageCursor) {
              setPageCursor(selectedArtifact.data.results.pageCursorOrIndicator);
            }

            // Now update the time range WITHOUT triggering a new fetch
            if (searchInput.start && searchInput.end) {
              // Just update the state directly without triggering a fetch
              setTimeRange &&
                setTimeRange({
                  start: searchInput.start,
                  end: searchInput.end,
                });
            }

            // Mark as loaded when done
            if (setIsLoading) {
              setIsLoading(false);
            }

            // We've handled everything from the artifact data, so return early
            // to prevent the time range change from triggering a fetch
            return;
          }
        }
      }

      // Only reach here if we don't have results in the artifact
      // In this case, we DO want to trigger a fetch with the time range
      if (searchInput.start && searchInput.end) {
        const newTimeRange = {
          start: searchInput.start,
          end: searchInput.end,
        };
        onTimeRangeChange(newTimeRange);
      } else if (searchInput.pageCursor && setPageCursor) {
        // Fallback to cursor in the input if results don't have it
        setPageCursor(searchInput.pageCursor);
      }
    }
  }, [
    selectedArtifact,
    setLogQuery,
    onTimeRangeChange,
    setLogs,
    setIsLoading,
    setPageCursor,
    setTimeRange,
  ]);

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onQuerySubmit(logQuery);
  };

  const handleAddFacet = (facet: string, value: string) => {
    // Parse the current query to understand its structure
    const currentQueryTerms = parseQueryString(logQuery);

    // Check if this facet already exists in the query
    if (facet in currentQueryTerms) {
      // If it does, modify it to add the new value with OR logic
      const currentValues = currentQueryTerms[facet];

      // If the value is already in this facet's list, remove it (toggle behavior)
      if (currentValues.includes(value)) {
        if (currentValues.length === 1) {
          // If this is the only value, remove the entire facet
          delete currentQueryTerms[facet];
        } else {
          // Remove just this value
          currentQueryTerms[facet] = currentValues.filter((v) => v !== value);
        }
      } else {
        // Add the new value to this facet
        currentQueryTerms[facet] = [...currentValues, value];
      }
    } else {
      // If facet doesn't exist, add it with the value
      currentQueryTerms[facet] = [value];
    }

    // Build the new query string
    const newQuery = buildQueryString(currentQueryTerms);

    // Update the query and then fetch logs
    setLogQuery(newQuery);

    // Trigger search with the new query
    onQuerySubmit(newQuery);
  };

  // Parse a query string into a structured object
  const parseQueryString = (query: string): Record<string, string[]> => {
    const result: Record<string, string[]> = {};
    const freeText: string[] = [];

    if (!query.trim()) {
      return result;
    }

    // Tokenize the query
    let remaining = query.trim();

    // Find facet:value pairs using a simplified approach
    const facetValuePattern = /([a-zA-Z0-9_-]+):((?:\([^)]+\)|[^\s]+))/g;
    let match;
    let lastIndex = 0;

    while ((match = facetValuePattern.exec(remaining)) !== null) {
      // Get everything before this match as potential free text
      const beforeMatch = remaining.substring(lastIndex, match.index).trim();
      if (beforeMatch.length > 0) {
        beforeMatch.split(/\s+/).forEach((term) => {
          if (term.trim()) freeText.push(term.trim());
        });
      }

      const [, facet, valueWithPossibleParens] = match;

      // Handle values with OR syntax
      if (valueWithPossibleParens.startsWith("(") && valueWithPossibleParens.endsWith(")")) {
        // Extract values between parentheses
        const valuesStr = valueWithPossibleParens.substring(1, valueWithPossibleParens.length - 1);
        const values = valuesStr
          .split(/\s+OR\s+/)
          .map((v) => v.trim())
          .filter(Boolean);

        if (!result[facet]) result[facet] = [];
        result[facet] = [...result[facet], ...values];
      } else {
        // Single value
        if (!result[facet]) result[facet] = [];
        result[facet].push(valueWithPossibleParens);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text as free text
    const remainingText = remaining.substring(lastIndex).trim();
    if (remainingText.length > 0) {
      remainingText.split(/\s+/).forEach((term) => {
        if (term.trim()) freeText.push(term.trim());
      });
    }

    // Add free text terms if there are any
    if (freeText.length > 0) {
      result["text"] = freeText;
    }

    return result;
  };

  // Build a query string from the structured object
  const buildQueryString = (queryTerms: Record<string, string[]>): string => {
    const parts: string[] = [];

    // Add text search terms first (if any)
    if (queryTerms["text"]) {
      parts.push(queryTerms["text"].join(" "));
    }

    // Add facet:value terms
    for (const [facet, values] of Object.entries(queryTerms)) {
      if (facet === "text" || values.length === 0) continue;

      if (values.length === 1) {
        // Single value
        parts.push(`${facet}:${values[0]}`);
      } else {
        // Multiple values using OR syntax
        parts.push(`${facet}:(${values.join(" OR ")})`);
      }
    }

    return parts.join(" ");
  };

  const handleLogSelect = (log: Log) => {
    setSelectedLog(log);
  };

  const handleToggleFacet = (facet: string) => {
    setSelectedFacets((prev) => {
      if (prev.includes(facet)) {
        return prev.filter((f) => f !== facet);
      } else {
        return [...prev, facet];
      }
    });
  };

  // Handle time range changes from the TimeRangePicker
  const handleTimeRangeChange = (newTimeRange: TimeRange) => {
    onTimeRangeChange(newTimeRange);
  };

  // Render facet sidebar section
  const renderFacetSection = () => (
    <div className="facets-sidebar">
      <h3>Facets</h3>
      {Array.isArray(facets) && facets.length > 0 ? (
        facets.map((facet, index) => (
          <div key={index} className="facet-group">
            <div
              className={`facet-header ${selectedFacets.includes(facet.name) ? "expanded" : ""}`}
              onClick={() => handleToggleFacet(facet.name)}
            >
              <span className="facet-name">{facet.name}</span>
              <span className="facet-toggle">
                {selectedFacets.includes(facet.name) ? "▼" : "▶"}
              </span>
            </div>
            {selectedFacets.includes(facet.name) && (
              <div className="facet-values">
                {facet.values.map((value, vIndex) => {
                  // Get the parsed query to check if this value is selected
                  const queryTerms = parseQueryString(logQuery);
                  const isSelected = queryTerms[facet.name]?.includes(value);

                  return (
                    <div
                      key={vIndex}
                      className={`facet-value ${isSelected ? "facet-value-selected" : ""}`}
                      onClick={() => handleAddFacet(facet.name, value)}
                    >
                      {value}
                      {facet.counts && (
                        <span className="facet-count">({facet.counts[vIndex]})</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="facet-loading">Loading facets...</div>
      )}
    </div>
  );

  // Render logs list section
  const renderLogsList = () => (
    <div className="logs-display">
      {isLoading ? (
        <div className="loading-indicator">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="empty-logs-message">
          No logs found. Try adjusting your query or time range.
        </div>
      ) : (
        <>
          <div className="logs-list">
            <div className="logs-list-header">
              <div className="log-column timestamp-column">Timestamp</div>
              <div className="log-column service-column">Service</div>
              <div className="log-column message-column">Message</div>
            </div>
            {logs.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                className={`compact-log-entry ${selectedLog && selectedLog.timestamp === log.timestamp && selectedLog.message === log.message ? "selected" : ""}`}
                onClick={() => {
                  handleLogSelect(log);
                }}
              >
                <div className={`log-level-indicator ${log.level}`}></div>
                <div className="log-entry-content">
                  <span className="log-timestamp">{formatDate(log.timestamp)}</span>
                  <span className="log-service">{log.service}</span>
                  <span className="log-message">{log.message}</span>
                </div>
              </div>
            ))}
            {logsWithPagination && logsWithPagination.pageCursorOrIndicator && (
              <div className="load-more-container">
                <button className="load-more-button" onClick={onLoadMore}>
                  Load More
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="logs-tab">
      <div className="logs-header">
        <div className="time-range-controls">
          <TimeRangePicker initialTimeRange={timeRange} onTimeRangeChange={handleTimeRangeChange} />
        </div>

        <div className="log-query-container">
          <SearchBar query={logQuery} setQuery={setLogQuery} onSubmit={handleQuerySubmit} />
        </div>
      </div>

      <div className="logs-content">
        {renderFacetSection()}
        {renderLogsList()}

        {selectedLog && (
          <div className="log-details-sidebar">
            <div className="log-details-header">
              <h3>Log Details</h3>
              <button className="close-details-button" onClick={() => setSelectedLog(null)}>
                ×
              </button>
            </div>
            <div className="log-details-content">
              <div className="log-detail">
                <span className="detail-label">Timestamp:</span>
                <span className="detail-value">{formatDate(selectedLog.timestamp)}</span>
              </div>
              <div className="log-detail">
                <span className="detail-label">Service:</span>
                <span className="detail-value">{selectedLog.service}</span>
              </div>
              <div className="log-detail">
                <span className="detail-label">Level:</span>
                <span className={`detail-value ${selectedLog.level}`}>{selectedLog.level}</span>
              </div>
              <div className="log-detail">
                <span className="detail-label">Message:</span>
                <span className="detail-value">{selectedLog.message}</span>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <>
                  <h4>Metadata</h4>
                  {Object.entries(selectedLog.metadata).map(([key, value]) => (
                    <div key={key} className="log-detail">
                      <span className="detail-label">{key}:</span>
                      <span className="detail-value">{value}</span>
                    </div>
                  ))}
                </>
              )}

              {selectedLog.attributes && Object.keys(selectedLog.attributes).length > 0 && (
                <>
                  <h4>Attributes</h4>
                  <pre className="attributes-json">
                    {JSON.stringify(selectedLog.attributes, null, 2)}
                  </pre>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsView;
