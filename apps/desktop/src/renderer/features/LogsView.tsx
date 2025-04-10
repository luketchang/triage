import React, { useEffect, useState } from "react";
import TimeRangePicker from "../components/TimeRangePicker";
import { timeRangePresets, useTimeRange } from "../hooks/useTimeRange";
import api from "../services/api";
import { Artifact, FacetData, Log, LogQueryParams } from "../types";
import { formatDate } from "../utils/formatters";

interface LogsViewProps {
  selectedArtifact?: Artifact | null;
}

// Dummy facet data for when API doesn't return any
const dummyFacets: FacetData[] = [
  {
    name: "service",
    values: ["orders", "payments", "auth", "api-gateway", "user-service"],
    counts: [5, 5, 5, 5, 5],
  },
  {
    name: "level",
    values: ["info", "warn", "error", "debug"],
    counts: [10, 5, 10, 5],
  },
  {
    name: "host",
    values: ["host-1", "host-2", "host-3", "host-4"],
    counts: [5, 5, 5, 5],
  },
  {
    name: "environment",
    values: ["production", "staging", "development"],
    counts: [5, 5, 10],
  },
  {
    name: "region",
    values: ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"],
    counts: [8, 7, 6, 5],
  },
  {
    name: "container",
    values: ["api-container", "worker-container", "db-container"],
    counts: [12, 8, 6],
  },
];

const LogsView: React.FC<LogsViewProps> = ({ selectedArtifact }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [logQuery, setLogQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [facets, setFacets] = useState<FacetData[]>(dummyFacets);
  const [selectedFacets, setSelectedFacets] = useState<string[]>([
    "service",
    "level",
    "host",
    "environment",
  ]);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [pageCursor, setPageCursor] = useState<string | undefined>(undefined);
  const [queryLimit] = useState<number>(100); // Default limit for number of logs
  const [activeFacetFilters, setActiveFacetFilters] = useState<Record<string, string[]>>({});

  const { timeRange, handleTimeRangePreset, handleTimeRangeChange } = useTimeRange();

  // Load facets when the component mounts or time range changes
  useEffect(() => {
    const loadFacets = async () => {
      try {
        const response = await api.getLogsFacetValues(timeRange.start, timeRange.end);
        if (response && response.success && response.data && response.data.length > 0) {
          setFacets(response.data);
        } else if (Array.isArray(response) && response.length > 0) {
          setFacets(response);
        } else {
          // Use dummy facets if API returns empty data
          setFacets(dummyFacets);
        }
      } catch (error) {
        console.error("Error loading facets:", error);
        // Use dummy facets if API fails
        setFacets(dummyFacets);
      }
    };

    loadFacets();
  }, [timeRange.start, timeRange.end]);

  // Effect to handle displaying artifact data if available
  useEffect(() => {
    if (selectedArtifact && selectedArtifact.type === "log") {
      try {
        // If artifact data is a log array, use it directly
        if (Array.isArray(selectedArtifact.data)) {
          setLogs(selectedArtifact.data as Log[]);
          // Update query to reflect we're viewing an artifact
          setLogQuery(`Artifact: ${selectedArtifact.title}`);
        } else if (typeof selectedArtifact.data === "string") {
          // If it's a string, try to parse it as JSON
          try {
            const parsedData = JSON.parse(selectedArtifact.data);
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

      // Build facet filter string
      let facetFilters = "";
      const facetParams = new URLSearchParams();

      // Add active facet filters to query params
      Object.entries(activeFacetFilters).forEach(([facet, values]) => {
        values.forEach((value) => {
          facetParams.append(facet, value);
        });
      });

      facetFilters = facetParams.toString();

      // Prepare query parameters
      const params: LogQueryParams = {
        query: logQuery,
        start: timeRange.start,
        end: timeRange.end,
        limit: queryLimit,
        facets: facetFilters,
      };

      // Add cursor for pagination if not resetting
      if (!resetCursor && pageCursor) {
        params.cursor = pageCursor;
      }

      const response = await api.fetchLogs(params);

      if (response && response.success && response.data) {
        let filteredLogs = response.data.logs || [];

        // Apply client-side filtering based on active facet filters if API doesn't support it
        if (Object.keys(activeFacetFilters).length > 0) {
          filteredLogs = filteredLogs.filter((log) => {
            return Object.entries(activeFacetFilters).every(([facet, values]) => {
              // Skip filtering if no values selected for this facet
              if (values.length === 0) return true;

              // Check if log matches any of the values for this facet
              if (facet === "service") {
                return values.includes(log.service);
              } else if (facet === "level") {
                return values.includes(log.level);
              } else if (log.metadata && log.metadata[facet]) {
                return values.includes(log.metadata[facet]);
              } else if (log.attributes && log.attributes[facet]) {
                return values.includes(String(log.attributes[facet]));
              }

              return false;
            });
          });
        }

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
    fetchLogs(true);
  };

  const handleAddFacet = (facet: string, value: string) => {
    // Toggle the facet value in the activeFacetFilters
    setActiveFacetFilters((prev) => {
      const newFilters = { ...prev };

      // Initialize the facet array if it doesn't exist
      if (!newFilters[facet]) {
        newFilters[facet] = [];
      }

      // Toggle the value
      if (newFilters[facet].includes(value)) {
        // Remove the value if it's already selected
        newFilters[facet] = newFilters[facet].filter((v) => v !== value);

        // Remove the facet entirely if there are no values
        if (newFilters[facet].length === 0) {
          delete newFilters[facet];
        }
      } else {
        // Add the value if it's not already selected
        newFilters[facet].push(value);
      }

      return newFilters;
    });

    // Update the logQuery string to include the facet filters
    updateQueryStringFromFacets();

    // Fetch logs with the new filters
    fetchLogs(true);
  };

  const updateQueryStringFromFacets = () => {
    // Convert active facet filters to a query string format
    const facetStrings = Object.entries(activeFacetFilters).map(([facet, values]) => {
      return values.map((value) => `${facet}:${value}`).join(" ");
    });

    // Get the base query without facet filters
    const baseQuery = logQuery
      .split(" ")
      .filter((term) => !term.includes(":"))
      .join(" ");

    // Combine the base query with facet filters
    const newQuery = [baseQuery, ...facetStrings].filter(Boolean).join(" ");

    setLogQuery(newQuery);
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

  // Initial log fetch when component mounts
  useEffect(() => {
    fetchLogs(true);
  }, []);

  return (
    <div className="logs-tab">
      <div className="logs-header">
        <div className="time-range-controls">
          <div className="time-range-presets">
            {timeRangePresets.map((preset) => (
              <button
                key={preset.label}
                className="time-preset-button"
                onClick={() => handleTimeRangePreset(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <TimeRangePicker
            timeRange={timeRange}
            timeRangePresets={timeRangePresets}
            onTimeRangeChange={handleTimeRangeChange}
            onTimeRangePreset={handleTimeRangePreset}
          />
        </div>

        <div className="log-query-container">
          <form className="log-query-form" onSubmit={handleQuerySubmit}>
            <input
              type="text"
              className="log-query-input"
              placeholder="Enter log query (e.g. service:orders level:error)"
              value={logQuery}
              onChange={(e) => setLogQuery(e.target.value)}
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
                      const isSelected = activeFacetFilters[facet.name]?.includes(value);
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

          {Object.keys(activeFacetFilters).length > 0 && (
            <div className="active-filters">
              <h4>Active Filters</h4>
              {Object.entries(activeFacetFilters).map(([facet, values]) => (
                <div key={facet} className="active-filter-group">
                  <div className="active-filter-name">{facet}:</div>
                  <div className="active-filter-values">
                    {values.map((value) => (
                      <div
                        key={value}
                        className="active-filter-value"
                        onClick={() => handleAddFacet(facet, value)}
                      >
                        {value} <span className="remove-filter">×</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button
                className="clear-all-filters"
                onClick={() => {
                  setActiveFacetFilters({});
                  setLogQuery("");
                  fetchLogs(true);
                }}
              >
                Clear All Filters
              </button>
            </div>
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
