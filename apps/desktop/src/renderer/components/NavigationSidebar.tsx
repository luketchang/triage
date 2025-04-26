import { ChatIcon, CodeIcon, DashboardsIcon, LogsIcon, TracesIcon } from "../icons";
import { TabType } from "../types";

interface NavigationSidebarProps {
  activeTab: TabType;
  handleTabChange: (tab: TabType) => void;
  contextItemsCount: number;
}

function NavigationSidebar({
  activeTab,
  handleTabChange,
  contextItemsCount,
}: NavigationSidebarProps) {
  return (
    <div className="navigation-sidebar">
      <div className="sidebar-header">
        <div className="logo">TRI</div>
      </div>
      <div className="sidebar-nav">
        <div
          className={`nav-item ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => handleTabChange("chat")}
          title="Chat"
        >
          <ChatIcon />
          <span className="nav-label">Chat</span>
          {contextItemsCount > 0 && <div className="context-count">{contextItemsCount}</div>}
        </div>
        <div
          className={`nav-item ${activeTab === "logs" ? "active" : ""}`}
          onClick={() => handleTabChange("logs")}
          title="Logs"
        >
          <LogsIcon />
          <span className="nav-label">Logs</span>
        </div>
        <div
          className={`nav-item ${activeTab === "traces" ? "active" : ""}`}
          onClick={() => handleTabChange("traces")}
          title="Traces"
        >
          <TracesIcon />
          <span className="nav-label">Traces</span>
        </div>
        <div
          className={`nav-item ${activeTab === "dashboards" ? "active" : ""}`}
          onClick={() => handleTabChange("dashboards")}
          title="Dashboards"
        >
          <DashboardsIcon />
          <span className="nav-label">Dashboards</span>
        </div>
        <div
          className={`nav-item ${activeTab === "code" ? "active" : ""}`}
          onClick={() => handleTabChange("code")}
          title="Code"
        >
          <CodeIcon />
          <span className="nav-label">Code</span>
        </div>
      </div>
      <div className="sidebar-footer">{/* Footer content can be added here if needed */}</div>
    </div>
  );
}

export default NavigationSidebar;
