import React from "react";

interface DashboardsViewProps {}

const DashboardsView: React.FC<DashboardsViewProps> = () => {
  return (
    <div className="dashboards-view">
      <div className="dashboards-placeholder">
        <h2>Dashboards View</h2>
        <p>Metrics and charts functionality will be implemented in a future update.</p>
      </div>
    </div>
  );
};

export default DashboardsView;
