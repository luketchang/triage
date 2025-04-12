import React from "react";
import { Artifact } from "../types";

interface TracesViewProps {
  selectedArtifact?: Artifact | null;
}

const TracesView: React.FC<TracesViewProps> = ({ selectedArtifact }) => {
  return (
    <div className="traces-view">
      <div className="traces-placeholder">
        <h2>Traces View</h2>
        <p>Distributed tracing functionality will be implemented in a future update.</p>
      </div>
    </div>
  );
};

export default TracesView;
