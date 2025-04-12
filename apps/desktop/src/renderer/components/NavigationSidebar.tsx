import { ChatIcon, CodeIcon, DashboardsIcon, LogsIcon, TracesIcon } from "../icons";
import { TabType } from "../types";

interface NavigationSidebarProps {
  activeTab: TabType;
  handleTabChange: (tab: TabType) => void;
  toggleChatSidebar: () => void;
  contextItemsCount: number;
}

function NavigationSidebar({
  activeTab,
  handleTabChange,
  toggleChatSidebar,
  contextItemsCount,
}: NavigationSidebarProps) {
  return (
    <div className="navigation-sidebar">
      <div className="sidebar-header">
        <div className="logo">TRI</div>
      </div>
      <div className="sidebar-nav">
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
      <div className="sidebar-footer">
        <div className="chat-toggle" onClick={toggleChatSidebar} title="Toggle Chat (⌘ + I)">
          <ChatIcon />
          {contextItemsCount > 0 && <div className="context-count">{contextItemsCount}</div>}
        </div>
      </div>
    </div>
  );
}

export default NavigationSidebar;
