import React from "react";
import { ChatIcon, CodeIcon, DashboardsIcon, LogsIcon, TracesIcon } from "../icons";
import { TabType } from "../types";

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onChatToggle: () => void;
  isChatSidebarOpen: boolean;
}

const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onChatToggle,
  isChatSidebarOpen,
}) => {
  return (
    <div className="navigation">
      <div className="tabs">
        <button
          className={`tab ${activeTab === "logs" ? "active" : ""}`}
          onClick={() => onTabChange("logs")}
        >
          <LogsIcon />
          <span>Logs</span>
        </button>
        <button
          className={`tab ${activeTab === "traces" ? "active" : ""}`}
          onClick={() => onTabChange("traces")}
        >
          <TracesIcon />
          <span>Traces</span>
        </button>
        <button
          className={`tab ${activeTab === "dashboards" ? "active" : ""}`}
          onClick={() => onTabChange("dashboards")}
        >
          <DashboardsIcon />
          <span>Dashboards</span>
        </button>
        <button
          className={`tab ${activeTab === "code" ? "active" : ""}`}
          onClick={() => onTabChange("code")}
        >
          <CodeIcon />
          <span>Code</span>
        </button>
      </div>
      <div className="chat-toggle">
        <button
          className={`chat-button ${isChatSidebarOpen ? "active" : ""}`}
          onClick={onChatToggle}
        >
          <ChatIcon />
          <span>Chat</span>
        </button>
      </div>
    </div>
  );
};

export default Navigation;
