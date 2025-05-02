import React, { useEffect, useState } from "react";
import TimeRangePicker from "../components/TimeRangePicker";
import { FacetData, UIServiceLatency, UISpan, UITrace } from "../types";
import { formatDate } from "../utils/formatters";

interface TracesViewProps {
  selectedTrace: UITrace | null;
  handleTraceSelect: (trace: UITrace | null) => void;
  traces: UITrace[];
  traceQuery: string;
  setTraceQuery: (query: string) => void;
  isLoading: boolean;
  timeRange: { start: string; end: string };
  fetchTracesWithQuery: (query: string) => void;
  handleLoadMoreTraces: () => void;
  handleTimeRangeChange: (timeRange: { start: string; end: string }) => void;
  facets: FacetData[];
  selectedFacets: string[];
  setSelectedFacets: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSpan: UISpan | null;
  handleSpanSelect: (span: UISpan) => void;
  pageCursor?: string;
  setSelectedSpan: React.Dispatch<React.SetStateAction<UISpan | null>>;
}

const TracesView: React.FC<TracesViewProps> = ({
  selectedTrace,
  handleTraceSelect,
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
  selectedSpan,
  handleSpanSelect,
  pageCursor,
  setSelectedSpan,
}) => {
  // Local UI-only state
  const [hoverCardPosition, setHoverCardPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoverCardTrace, setHoverCardTrace] = useState<UITrace | null>(null);

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
    const facetValuePattern = /([a-zA-Z0-9_.-]+):((?:\([^)]+\)|[^\s]+))/g;
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

  // Handle adding or removing a facet value to/from the query
  const handleAddFacet = (facet: string, value: string) => {
    // Parse the current query to understand its structure
    const currentQueryTerms = parseQueryString(traceQuery);

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

    // Update the query and then fetch traces
    setTraceQuery(newQuery);

    // Trigger search with the new query
    // fetchTracesWithQuery(newQuery); // Removed: useEffect in useTraces handles this
  };

  // Close hover card when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setHoverCardPosition(null);
      setHoverCardTrace(null);
    };

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // Add escape key handler to close hover card and trace details
  useEffect(() => {
    const handleEscapeKey = (_e: KeyboardEvent) => {
      if (_e.key === "Escape") {
        // Close hover card if open
        if (hoverCardPosition || hoverCardTrace) {
          setHoverCardPosition(null);
          setHoverCardTrace(null);
        }
        // Close trace details if open
        if (selectedTrace) {
          handleTraceSelect(null);
        }
        // Close span details if open
        if (selectedSpan) {
          setSelectedSpan(null);
        }
        // Close trace details panel if open
        else if (selectedTrace) {
          handleTraceSelect(null);
        }
      }
    };

    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [
    hoverCardPosition,
    hoverCardTrace,
    selectedTrace,
    selectedSpan,
    handleTraceSelect,
    setSelectedSpan,
  ]);

  // Calculate the percentage position for waterfall chart bars
  const calculateSpanPosition = (
    spanStart: Date,
    spanEnd: Date,
    traceStart: Date,
    traceDuration: number
  ) => {
    const relativeStart = spanStart.getTime() - traceStart.getTime();
    const relativeDuration = spanEnd.getTime() - spanStart.getTime();

    const leftPercent = (relativeStart / traceDuration) * 100;
    const widthPercent = (relativeDuration / traceDuration) * 100;

    // Ensure minimum width of 0.5% for visibility
    const minWidthPercent = 0.1;
    const finalWidthPercent = Math.max(widthPercent, minWidthPercent);

    return {
      left: `${leftPercent}%`,
      width: `${finalWidthPercent}%`,
    };
  };

  // Format duration in a human-readable way
  const formatDuration = (durationMs: number): string => {
    if (durationMs < 1) {
      return `${(durationMs * 1000).toFixed(2)}µs`;
    }
    if (durationMs < 1000) {
      return `${durationMs.toFixed(2)}ms`;
    }
    return `${(durationMs / 1000).toFixed(2)}s`;
  };

  // Render the service breakdown legend
  const renderServiceBreakdownLegend = (serviceBreakdown: UIServiceLatency[]) => {
    return (
      <div className="service-breakdown-legend">
        {serviceBreakdown.map((service, idx) => (
          <div key={`legend-${service.service}-${idx}`} className="legend-item">
            <div className="color-swatch" style={{ backgroundColor: service.color }} />
            <span className="service-name">{service.service}</span>
            <span className="service-duration">{formatDuration(service.duration)}</span>
            <span className="service-percentage">({service.percentage.toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    );
  };

  // Handle form submission
  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracesWithQuery(traceQuery);
  };

  // Render waterfall chart for the trace
  const renderWaterfallChart = () => {
    if (!selectedTrace) return null;

    const { displayTrace } = selectedTrace;
    const renderSpan = (span: UISpan, depth = 0, maxDepth = 20) => {
      if (depth > maxDepth) return null; // Prevent infinite recursion

      const isSelected = selectedSpan && selectedSpan.id === span.id;
      const hasError = !!span.error;

      // Find the service color from the serviceBreakdown
      const serviceColor =
        selectedTrace.serviceBreakdown.find((s: UIServiceLatency) => s.service === span.service)
          ?.color || "#4D54EB";

      const position = calculateSpanPosition(
        new Date(span.start),
        new Date(span.end),
        new Date(displayTrace.startTime),
        displayTrace.totalDuration
      );

      return (
        <div key={span.id}>
          <div
            className={`waterfall-span ${isSelected ? "selected" : ""} ${hasError ? "has-error" : ""}`}
            style={{ marginLeft: `${depth * 20}px` }}
            onClick={() => handleSpanSelect(span)}
          >
            <div className="waterfall-bar-container">
              <div
                className="waterfall-bar"
                style={{
                  left: position.left,
                  width: position.width,
                  backgroundColor: serviceColor,
                }}
              />
            </div>
            <div className="waterfall-info">
              <span className="span-service">{span.service}</span>
              <span className="span-resource">{span.resource}</span>
              <span className="span-duration">{formatDuration(span.duration)}</span>
            </div>
          </div>

          {/* Render children recursively */}
          {Array.isArray(span.children) &&
            span.children.map((child: UISpan) => renderSpan(child, depth + 1, maxDepth))}
        </div>
      );
    };

    return (
      <div className="waterfall-chart">
        <div className="waterfall-header">
          <div className="waterfall-header-left">Span</div>
          <div className="waterfall-header-right">Service / Resource</div>
        </div>
        <div className="waterfall-body">
          {displayTrace.rootSpan && renderSpan(displayTrace.rootSpan)}
        </div>
      </div>
    );
  };

  // Handle mouse over for service breakdown
  const handleServiceBreakdownHover = (e: React.MouseEvent, trace: UITrace) => {
    e.stopPropagation(); // Prevent triggering parent click events

    const rect = e.currentTarget.getBoundingClientRect();
    setHoverCardPosition({
      x: rect.left,
      y: rect.bottom + window.scrollY,
    });
    setHoverCardTrace(trace);
  };

  // Handle mouse leave for service breakdown
  const handleServiceBreakdownLeave = (_e: React.MouseEvent) => {
    // We'll keep the card visible until user clicks elsewhere
  };

  return (
    <div className="traces-tab">
      <div className="traces-header">
        <div className="time-range-controls">
          <TimeRangePicker initialTimeRange={timeRange} onTimeRangeChange={handleTimeRangeChange} />
        </div>

        <div className="trace-query-container">
          <form className="trace-query-form" onSubmit={handleQuerySubmit}>
            <input
              type="text"
              className="trace-query-input"
              placeholder="Enter span query (e.g. service:orders resource:/api/checkout)"
              value={traceQuery}
              onChange={(e) => setTraceQuery(e.target.value)}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  fetchTracesWithQuery(traceQuery);
                }
              }}
            />
            <button type="submit" className="query-submit-button">
              Search
            </button>
          </form>
        </div>
      </div>

      <div className={`traces-content ${selectedTrace ? "with-selected-trace" : ""}`}>
        <div className="facets-sidebar">
          <h3>Facets</h3>
          {Array.isArray(facets) && facets.length > 0 ? (
            facets.map((facet, index) => (
              <div key={index} className="facet-group">
                <div
                  className={`facet-header ${selectedFacets.includes(facet.name) ? "expanded" : ""}`}
                  onClick={() =>
                    setSelectedFacets((prev) => {
                      if (prev.includes(facet.name)) {
                        return prev.filter((f) => f !== facet.name);
                      } else {
                        return [...prev, facet.name];
                      }
                    })
                  }
                >
                  <span className="facet-name">{facet.name}</span>
                  <span className="facet-toggle">
                    {selectedFacets.includes(facet.name) ? "▼" : "▶"}
                  </span>
                </div>
                {selectedFacets.includes(facet.name) && (
                  <div className="facet-values">
                    {facet.values.map((value: string, vIndex: number) => {
                      // Get the parsed query to check if this value is selected
                      const queryTerms = parseQueryString(traceQuery);
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

        <div className="traces-display">
          {isLoading ? (
            <div className="loading-indicator">Loading traces...</div>
          ) : traces.length === 0 ? (
            <div className="empty-traces-message">
              No traces found. Try adjusting your query or time range.
            </div>
          ) : (
            <>
              <div className="traces-list">
                <div className="traces-list-header">
                  <div className="trace-column timestamp-column">Timestamp</div>
                  <div className="trace-column service-column">Root Service</div>
                  <div className="trace-column resource-column">Resource</div>
                  <div className="trace-column duration-column">Duration</div>
                  <div className="trace-column status-column">Status</div>
                  <div className="trace-column breakdown-column">Latency Breakdown</div>
                </div>
                {traces.map((trace) => (
                  <div
                    key={trace.traceId}
                    className={`compact-trace-entry ${selectedTrace && selectedTrace.traceId === trace.traceId ? "selected" : ""} ${trace.hasError ? "has-error" : ""}`}
                    onClick={() => handleTraceSelect(trace)}
                  >
                    <div className="trace-entry-content">
                      <span className="trace-timestamp">{formatDate(trace.startTime)}</span>
                      <span className="trace-service">{trace.rootService}</span>
                      <span className="trace-resource">{trace.rootResource}</span>
                      <span className="trace-duration">{formatDuration(trace.duration)}</span>
                      <span
                        className={`trace-status ${trace.httpStatus ? `http-${trace.httpStatus.charAt(0)}xx` : ""}`}
                      >
                        {trace.httpStatus || "N/A"}
                      </span>
                      <div
                        className="trace-breakdown"
                        onMouseEnter={(e) => handleServiceBreakdownHover(e, trace)}
                        onMouseLeave={handleServiceBreakdownLeave}
                      >
                        <div className="service-breakdown-container">
                          <div className="service-breakdown-bar">
                            {trace.serviceBreakdown.map(
                              (service: UIServiceLatency, idx: number) => (
                                <div
                                  key={`${service.service}-${idx}`}
                                  className="service-breakdown-segment"
                                  style={{
                                    width: `${service.percentage}%`,
                                    backgroundColor: service.color,
                                  }}
                                  title={`${service.service}: ${formatDuration(service.duration)} (${service.percentage.toFixed(1)}%)`}
                                />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {traces.length > 0 && pageCursor && (
                  <div className="load-more-container">
                    <button className="load-more-button" onClick={handleLoadMoreTraces}>
                      Load More
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {selectedTrace && (
          <div className="trace-details-panel">
            <div className="trace-details-header">
              <h3>Trace Details</h3>
              <button className="close-details-button" onClick={() => handleTraceSelect(null)}>
                ×
              </button>
            </div>
            <div className="trace-details-content">
              <div className="trace-detail">
                <span className="detail-label">Trace ID:</span>
                <span className="detail-value trace-id">{selectedTrace.traceId}</span>
              </div>
              <div className="trace-detail">
                <span className="detail-label">Root Service:</span>
                <span className="detail-value">{selectedTrace.rootService}</span>
              </div>
              <div className="trace-detail">
                <span className="detail-label">Resource:</span>
                <span className="detail-value">{selectedTrace.rootResource}</span>
              </div>
              <div className="trace-detail">
                <span className="detail-label">Duration:</span>
                <span className="detail-value">{formatDuration(selectedTrace.duration)}</span>
              </div>
              <div className="trace-detail">
                <span className="detail-label">HTTP Status:</span>
                <span
                  className={`detail-value http-status ${selectedTrace.httpStatus ? `http-${selectedTrace.httpStatus.charAt(0)}xx` : ""}`}
                >
                  {selectedTrace.httpStatus || "N/A"}
                </span>
              </div>

              <h4>Waterfall View</h4>
              <div className="trace-waterfall">{renderWaterfallChart()}</div>

              {selectedSpan && (
                <>
                  <h4>Selected Span Details</h4>
                  <div className="span-details">
                    <div className="span-detail">
                      <span className="detail-label">Span ID:</span>
                      <span className="detail-value">{selectedSpan.id}</span>
                    </div>
                    <div className="span-detail">
                      <span className="detail-label">Service:</span>
                      <span className="detail-value">{selectedSpan.service}</span>
                    </div>
                    <div className="span-detail">
                      <span className="detail-label">Operation:</span>
                      <span className="detail-value">{selectedSpan.operation}</span>
                    </div>
                    <div className="span-detail">
                      <span className="detail-label">Resource:</span>
                      <span className="detail-value">{selectedSpan.resource}</span>
                    </div>
                    <div className="span-detail">
                      <span className="detail-label">Duration:</span>
                      <span className="detail-value">{formatDuration(selectedSpan.duration)}</span>
                    </div>

                    {selectedSpan.error && (
                      <div className="span-error">
                        <h5>Error</h5>
                        <div className="error-message">{selectedSpan.error.message}</div>
                        <div className="error-type">{selectedSpan.error.type}</div>
                        {selectedSpan.error.stack && (
                          <pre className="error-stack">{selectedSpan.error.stack}</pre>
                        )}
                      </div>
                    )}

                    {selectedSpan.tags && Object.keys(selectedSpan.tags).length > 0 && (
                      <>
                        <h5>Tags</h5>
                        <div className="span-tags">
                          {Object.entries(selectedSpan.tags).map(([key, value]) => (
                            <div key={key} className="tag-item">
                              <span className="tag-key">{key}:</span>
                              <span className="tag-value">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Service Breakdown Hover Card */}
        {hoverCardPosition && hoverCardTrace && (
          <div
            className="service-breakdown-hover-card"
            style={{
              left: `${hoverCardPosition.x}px`,
              top: `${hoverCardPosition.y}px`,
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking card
          >
            <h4>Service Latency Breakdown</h4>
            <div className="trace-service-legend">
              {renderServiceBreakdownLegend(hoverCardTrace.serviceBreakdown)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TracesView;
