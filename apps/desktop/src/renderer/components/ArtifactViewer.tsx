import React from "react";
import { Artifact, CodeMap, Log } from "../types";
import { formatTimestamp } from "../utils/formatters";

interface ArtifactViewerProps {
  artifact: Artifact | null;
  onClose: () => void;
}

const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ artifact, onClose }) => {
  if (!artifact) return null;

  const renderCodeArtifact = (codeMap: CodeMap) => {
    const files = Array.from(codeMap.entries());

    if (files.length === 0) {
      return <div className="empty-code">No code files available.</div>;
    }

    return (
      <div className="code-container">
        {files.map(([fileName, code], index) => (
          <div key={index} className="code-file">
            <div className="code-filename">{fileName}</div>
            <pre className="code-content">
              <code>{code}</code>
            </pre>
          </div>
        ))}
      </div>
    );
  };

  const renderLogArtifact = (logs: Log[]) => {
    return (
      <div className="log-artifact-container">
        <div className="log-list">
          {logs.map((log, index) => (
            <div key={index} className="log-item">
              <div className="log-timestamp">{formatTimestamp(log.timestamp)}</div>
              <div className="log-level">{log.level}</div>
              <div className="log-service">{log.service}</div>
              <div className="log-message">{log.message}</div>
              {log.attributes && (
                <div className="log-attributes">
                  {Object.entries(log.attributes).map(([key, value], attrIndex) => (
                    <div key={attrIndex} className="log-attribute">
                      <span className="attribute-key">{key}:</span>
                      <span className="attribute-value">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderArtifactContent = () => {
    switch (artifact.type) {
      case "code":
        return renderCodeArtifact(artifact.data);
      case "log":
        if (
          artifact.data.results &&
          typeof artifact.data.results === "object" &&
          "logs" in artifact.data.results
        ) {
          return renderLogArtifact(artifact.data.results.logs);
        }
        return <div>No log results available</div>;
      default:
        // We should never reach this due to the discriminated union
        return <div>Unknown artifact type</div>;
    }
  };

  return (
    <div className="artifact-viewer">
      <div className="artifact-viewer-header">
        <div className="artifact-title">{artifact.title}</div>
        <div className="artifact-type">{artifact.type}</div>
        <button className="close-button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="artifact-viewer-content">{renderArtifactContent()}</div>
    </div>
  );
};

export default ArtifactViewer;
