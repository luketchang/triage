import React from "react";
import { Artifact } from "../types";

interface TracesViewProps {
  selectedArtifact?: Artifact | null;
}

const TracesView: React.FC<TracesViewProps> = ({ selectedArtifact }) => {
  return (
    <div className="traces-view">
      {selectedArtifact && selectedArtifact.type === "trace" ? (
        <pre className="artifact-data-dump">
          {typeof selectedArtifact.data === "string"
            ? selectedArtifact.data
            : JSON.stringify(selectedArtifact.data, null, 2)}
        </pre>
      ) : (
        <div className="traces-placeholder">
          <h2>Traces View</h2>
          <p>Distributed tracing functionality will be implemented here.</p>
        </div>
      )}
    </div>
  );
};

export default TracesView;
