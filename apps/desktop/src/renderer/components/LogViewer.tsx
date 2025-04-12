import React, { useEffect, useState } from "react";
import { FacetData, Log } from "../types";
import { formatDate } from "../utils/formatters";

interface LogViewerProps {
  logs: Log[];
  facets: FacetData[];
  selectedFacets: string[];
  isLoading: boolean;
  pageCursor?: string;
  handleLogSelect: (log: Log) => void;
  handleLoadMore: () => void;
  handleToggleFacet: (facet: string) => void;
  handleAddFacet: (facet: string, value: string) => void;
}

const LogViewer: React.FC<LogViewerProps> = ({
  logs,
  facets,
  selectedFacets,
  isLoading,
  pageCursor,
  handleLogSelect,
  handleLoadMore,
  handleToggleFacet,
  handleAddFacet,
}) => {
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});

  // Add an event listener for the Escape key to collapse expanded logs
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && Object.values(expandedLogs).some((value) => value)) {
        setExpandedLogs({});
      }
    };

    // Add the event listener
    window.addEventListener("keydown", handleKeyDown);

    // Clean up the event listener when component unmounts
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedLogs]);

  const toggleLogExpansion = (index: number) => {
    setExpandedLogs((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const getLogLevelClass = (level: string): string => {
    level = level.toLowerCase();
    switch (level) {
      case "error":
        return "log-level-error";
      case "warn":
      case "warning":
        return "log-level-warn";
      case "info":
        return "log-level-info";
      case "debug":
        return "log-level-debug";
      case "trace":
        return "log-level-trace";
      default:
        return "";
    }
  };

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
                {facet.values.map((value, vIndex) => (
                  <div
                    key={vIndex}
                    className="facet-value"
                    onClick={() => handleAddFacet(facet.name, value)}
                  >
                    {value}
                    {facet.counts && <span className="facet-count">({facet.counts[vIndex]})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="facet-loading">Loading facets...</div>
      )}
    </div>
  );

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
                className={`compact-log-entry ${expandedLogs[index] ? "expanded" : ""}`}
                onClick={() => {
                  handleLogSelect(log);
                  toggleLogExpansion(index);
                }}
              >
                <div className={`log-level-indicator ${log.level}`}></div>
                <div className="log-entry-content">
                  <span className="log-timestamp">{formatDate(log.timestamp)}</span>
                  <span className="log-service">{log.service}</span>
                  <span className="log-message">{log.message}</span>
                </div>
                {expandedLogs[index] && (
                  <div className="log-details-expanded">
                    <div className="log-attributes">
                      {log.attributes &&
                        Object.entries(log.attributes).map(([key, value], attrIndex) => (
                          <div key={attrIndex} className="log-attribute">
                            <span className="log-attribute-key">{key}:</span>
                            <span className="log-attribute-value">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                    </div>
                    {log.metadata && (
                      <div className="log-metadata">
                        {Object.entries(log.metadata).map(([key, value], metaIndex) => (
                          <div key={metaIndex} className="log-metadata-item">
                            <span className="log-metadata-key">{key}:</span>
                            <span className="log-metadata-value">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
  );

  return (
    <div className="logs-container">
      {renderFacetSection()}
      {renderLogsList()}
    </div>
  );
};

export default LogViewer;
