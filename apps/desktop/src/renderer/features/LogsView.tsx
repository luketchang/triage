import React, { useEffect, useState } from "react";
import TimeRangePicker, {
  DEFAULT_END_DATE,
  DEFAULT_START_DATE,
} from "../components/TimeRangePicker";
import { FacetData, LogQueryParams } from "../electron.d";
import api from "../services/api";
import { Artifact, Log, LogSearchParams, TimeRange } from "../types";
import { formatDate } from "../utils/formatters";

interface LogsViewProps {
  selectedArtifact?: Artifact | null;
}

const LogsView: React.FC<LogsViewProps> = ({ selectedArtifact }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [logQuery, setLogQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [facets, setFacets] = useState<FacetData[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<string[]>([
    "service",
    "level",
    "host",
    "environment",
  ]);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [pageCursor, setPageCursor] = useState<string | undefined>(undefined);
  const [queryLimit] = useState<number>(100); // Default limit for number of logs
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: DEFAULT_START_DATE.toISOString(),
    end: DEFAULT_END_DATE.toISOString(),
  });

  // Load facets when the component mounts or time range changes
  useEffect(() => {
    const loadFacets = async () => {
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
          console.log("No valid facet data received, using empty array");
          // If API returns empty data, use an empty array
          setFacets([]);
        }
      } catch (error) {
        console.error("Error loading facets:", error);
        // If API fails, use an empty array
        setFacets([]);
      }
    };

    loadFacets();
  }, [timeRange.start, timeRange.end]);

  // Effect to handle displaying artifact data if available
  useEffect(() => {
    if (selectedArtifact && selectedArtifact.type === "log") {
      try {
        const artifactData = selectedArtifact.data;

        // Check if artifact data is a LogSearchParams object
        if (artifactData && typeof artifactData === "object" && "query" in artifactData) {
          const searchParams = artifactData as LogSearchParams;

          // Update the query field
          setLogQuery(searchParams.query);

          // Update the time range if available
          if (searchParams.start && searchParams.end) {
            const newTimeRange = {
              start: searchParams.start,
              end: searchParams.end,
            };

            setTimeRange(newTimeRange);

            // Execute the search with the new parameters and time range
            fetchLogsWithQuery(searchParams.query, newTimeRange);
          } else {
            // If no time range in the search params, just use the query
            fetchLogsWithQuery(searchParams.query);
          }
        }
        // If artifact data is a log array, use it directly (backward compatibility)
        else if (Array.isArray(artifactData)) {
          setLogs(artifactData as Log[]);
          // Update query to reflect we're viewing an artifact
          setLogQuery(`Artifact: ${selectedArtifact.title}`);
        }
        // If it's a string, try to parse it as JSON
        else if (typeof artifactData === "string") {
          try {
            const parsedData = JSON.parse(artifactData);
            if (Array.isArray(parsedData)) {
              setLogs(parsedData);
              setLogQuery(`Artifact: ${selectedArtifact.title}`);
            }
          } catch (parseError) {
            console.error("Error parsing log artifact data:", parseError);
          }
        }
      } catch (error) {
        console.error("Error displaying log artifact:", error);
      }
    }
  }, [selectedArtifact]);

  // Fetch logs based on query, time range, and facets
  const fetchLogs = async (resetCursor = true) => {
    setIsLoading(true);

    try {
      // Skip API call if we're displaying artifact logs
      if (selectedArtifact && selectedArtifact.type === "log") {
        setIsLoading(false);
        return;
      }

      // Prepare query parameters
      const params: LogQueryParams = {
        query: logQuery,
        start: timeRange.start,
        end: timeRange.end,
        limit: queryLimit,
      };

      // Add cursor for pagination if not resetting
      if (!resetCursor && pageCursor) {
        params.pageCursor = pageCursor;
      }

      console.log("Fetching logs with params:", params);
      const response = await api.fetchLogs(params);

      if (response && response.success && response.data) {
        let filteredLogs = response.data.logs || [];
        console.log(`API returned ${filteredLogs.length} logs`);

        // We'll let the server handle the filtering based on the query string
        // instead of trying to replicate the filtering logic client-side

        if (resetCursor) {
          setLogs(filteredLogs);
        } else {
          setLogs((prev) => [...prev, ...filteredLogs]);
        }

        // Update the cursor for next page
        setPageCursor(response.data.pageCursorOrIndicator);
      } else {
        console.warn("Invalid response format from fetchLogs:", response);
        if (resetCursor) {
          setLogs([]);
        }
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      if (resetCursor) {
        setLogs([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Fetch logs with the current query
    fetchLogsWithQuery(logQuery);
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

    // Force a sync log fetch
    console.log(`Updating query to: ${newQuery}`);
    fetchLogsWithQuery(newQuery);
  };

  // Helper function to fetch logs with a specific query
  const fetchLogsWithQuery = (query: string, customTimeRange?: TimeRange) => {
    setIsLoading(true);

    try {
      // Prepare query parameters
      const params: LogQueryParams = {
        query: query, // Use the provided query instead of state
        start: customTimeRange ? customTimeRange.start : timeRange.start,
        end: customTimeRange ? customTimeRange.end : timeRange.end,
        limit: queryLimit,
      };

      console.log("Fetching logs with params:", params);

      // Execute the API call
      api
        .fetchLogs(params)
        .then((response) => {
          if (response && response.success && response.data) {
            let filteredLogs = response.data.logs || [];
            console.log(`API returned ${filteredLogs.length} logs`);

            setLogs(filteredLogs);

            // Update the cursor for next page
            setPageCursor(response.data.pageCursorOrIndicator);
          } else {
            console.warn("Invalid response format from fetchLogs:", response);
            setLogs([]);
          }

          // Set loading to false once done
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching logs:", error);
          setLogs([]);
          setIsLoading(false);
        });
    } catch (error) {
      console.error("Error in fetchLogsWithQuery:", error);
      setLogs([]);
      setIsLoading(false);
    }
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

  const handleLoadMore = () => {
    if (pageCursor) {
      fetchLogs(false);
    }
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
    setTimeRange(newTimeRange);
    fetchLogs(true);
  };

  // Initial log fetch when component mounts
  useEffect(() => {
    fetchLogs(true);
  }, []);

  return (
    <div className="logs-tab">
      <div className="logs-header">
        <div className="time-range-controls">
          <TimeRangePicker initialTimeRange={timeRange} onTimeRangeChange={handleTimeRangeChange} />
        </div>

        <div className="log-query-container">
          <form className="log-query-form" onSubmit={handleQuerySubmit}>
            <input
              type="text"
              className="log-query-input"
              placeholder="Enter log query (e.g. service:orders level:error)"
              value={logQuery}
              onChange={(e) => {
                const newQuery = e.target.value;
                setLogQuery(newQuery);
              }}
              // Add key up event handler to perform search on enter key
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  fetchLogsWithQuery(logQuery);
                }
              }}
            />
            <button type="submit" className="query-submit-button">
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="logs-content">
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
                {logs.map((log, index) => (
                  <div
                    key={`${log.timestamp}-${index}`}
                    className={`log-entry ${selectedLog && selectedLog.timestamp === log.timestamp && selectedLog.message === log.message ? "selected" : ""}`}
                    onClick={() => handleLogSelect(log)}
                  >
                    <div className="log-entry-header">
                      <span className="log-timestamp">{formatDate(log.timestamp)}</span>
                      <div className="log-tags">
                        <span className={`service-tag ${log.service}`}>{log.service}</span>
                        <span className={`level-tag ${log.level}`}>{log.level}</span>
                      </div>
                    </div>
                    <div className="log-message">{log.message}</div>
                  </div>
                ))}
                {pageCursor && (
                  <div className="load-more-container">
                    <button className="load-more-button" onClick={handleLoadMore}>
                      Load More
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

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
