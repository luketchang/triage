import React from "react";
import { Artifact } from "../types";

interface DashboardsViewProps {
  selectedArtifact?: Artifact | null;
}

const DashboardsView: React.FC<DashboardsViewProps> = ({ selectedArtifact }) => {
  return (
    <div className="dashboards-view">
      {selectedArtifact &&
      (selectedArtifact.type === "dashboard" || selectedArtifact.type === "image") ? (
        <div className="artifact-data-dump">
          {typeof selectedArtifact.data === "string" ? (
            selectedArtifact.type === "image" ? (
              <img
                src={selectedArtifact.data}
                alt={selectedArtifact.title}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            ) : (
              selectedArtifact.data
            )
          ) : (
            JSON.stringify(selectedArtifact.data, null, 2)
          )}
        </div>
      ) : (
        <div className="dashboards-placeholder">
          <h2>Dashboards View</h2>
          <p>Metrics and charts functionality will be implemented here.</p>
        </div>
      )}
    </div>
  );
};

export default DashboardsView;
