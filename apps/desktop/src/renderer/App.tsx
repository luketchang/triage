import { useState } from "react";
import "./electron.d";
import "./styles-chat-sidebar.css";
import "./styles-chat.css";
import "./styles.css";

import api from "./services/api";
import { Artifact, ContextItem, LogSearchInputCore, TabType } from "./types";
import { generateId } from "./utils/formatters";

// Components
import ChatSidebar from "./components/ChatSidebar";
import NavigationSidebar from "./components/NavigationSidebar";

// Feature Views
import CodeView from "./features/CodeView";
import DashboardsView from "./features/DashboardsView";
import LogsView from "./features/LogsView";
import TracesView from "./features/TracesView";

// Custom hooks
import { useChat } from "./hooks/useChat";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useLogs } from "./hooks/useLogs";

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>("logs");
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  // Use custom hooks
  const logsState = useLogs();
  const chatState = useChat();

  // Setup keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "i",
      metaKey: true,
      action: () => chatState.toggleChatSidebar(),
    },
    {
      key: "u",
      metaKey: true,
      action: () => addCurrentContextToChat(),
    },
  ]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleArtifactClick = (artifact: Artifact): void => {
    setSelectedArtifact(artifact);

    // Automatically switch to the appropriate tab based on artifact type
    if (artifact.type === "log") {
      setActiveTab("logs");
    } else if (artifact.type === "code") {
      setActiveTab("code");
    }
  };

  // Add current view context to chat sidebar
  const addCurrentContextToChat = async (): Promise<void> => {
    let newContextItem: ContextItem | null = null;

    switch (activeTab) {
      case "logs":
        // Create context from logs view
        if (logsState.logQuery) {
          // Fetch logs to create a proper pairing of input and results
          const params = {
            query: logsState.logQuery,
            start: logsState.timeRange.start,
            end: logsState.timeRange.end,
            limit: 500, // Use a reasonable limit
            pageCursor: logsState.pageCursor,
          };

          try {
            // Fetch the logs with current parameters
            const response = await api.fetchLogs(params);

            if (response && response.success && response.data) {
              // Create a LogSearchInputCore object
              const logSearchInput: LogSearchInputCore = {
                query: logsState.logQuery,
                start: logsState.timeRange.start,
                end: logsState.timeRange.end,
                limit: 500,
                pageCursor: logsState.pageCursor || null,
                type: "logSearchInput",
              };

              // Create the context item with proper pairing
              newContextItem = {
                id: generateId(),
                type: "logSearch",
                title: logsState.logQuery || "Log Query",
                description: `Time: ${new Date(logsState.timeRange.start).toLocaleString()} - ${new Date(logsState.timeRange.end).toLocaleString()}`,
                data: {
                  input: logSearchInput,
                  results: response.data,
                },
                sourceTab: "logs",
              };
            }
          } catch (error) {
            console.error("Error fetching logs for context:", error);
          }
        }
        break;
      case "traces":
      case "code":
      case "dashboards":
        // Implement for other tabs as needed
        break;
    }

    if (newContextItem) {
      chatState.setContextItems((prev) => [...prev, newContextItem!]);

      // Open chat sidebar if it's closed
      if (!chatState.isChatSidebarOpen) {
        chatState.setIsChatSidebarOpen(true);
      }
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "logs":
        return (
          <LogsView
            logs={logsState.logs}
            logQuery={logsState.logQuery}
            timeRange={logsState.timeRange}
            isLoading={logsState.isLoading}
            setLogQuery={logsState.setLogQuery}
            onTimeRangeChange={logsState.handleTimeRangeChange}
            onQuerySubmit={logsState.fetchLogsWithQuery}
            onLoadMore={logsState.handleLoadMoreLogs}
            selectedArtifact={
              selectedArtifact && selectedArtifact.type === "log" ? selectedArtifact : null
            }
            setLogs={logsState.setLogs}
            setIsLoading={logsState.setIsLoading}
            setPageCursor={logsState.setPageCursor}
            setTimeRange={logsState.setTimeRange}
          />
        );
      case "traces":
        return <TracesView selectedArtifact={null} />;
      case "dashboards":
        return <DashboardsView selectedArtifact={null} />;
      case "code":
        return (
          <CodeView
            selectedArtifact={
              selectedArtifact && selectedArtifact.type === "code" ? selectedArtifact : null
            }
          />
        );
      default:
        return (
          <LogsView
            logs={logsState.logs}
            logQuery={logsState.logQuery}
            timeRange={logsState.timeRange}
            isLoading={logsState.isLoading}
            setLogQuery={logsState.setLogQuery}
            onTimeRangeChange={logsState.handleTimeRangeChange}
            onQuerySubmit={logsState.fetchLogsWithQuery}
            onLoadMore={logsState.handleLoadMoreLogs}
            selectedArtifact={null}
            setLogs={logsState.setLogs}
            setIsLoading={logsState.setIsLoading}
            setPageCursor={logsState.setPageCursor}
            setTimeRange={logsState.setTimeRange}
          />
        );
    }
  };

  return (
    <div
      className={`app-container observability-layout ${chatState.isChatSidebarOpen ? "with-chat-sidebar" : ""}`}
    >
      {/* Vertical Navigation Sidebar */}
      <NavigationSidebar
        activeTab={activeTab}
        handleTabChange={handleTabChange}
        toggleChatSidebar={chatState.toggleChatSidebar}
        contextItemsCount={chatState.contextItems.length}
      />

      {/* Main Content Area */}
      <div className="main-content-wrapper">{renderMainContent()}</div>

      {/* Chat Sidebar */}
      {chatState.isChatSidebarOpen && (
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <button
              className="close-chat-button"
              onClick={chatState.toggleChatSidebar}
              title="Close Chat (⌘ + I)"
            >
              ×
            </button>
          </div>
          <ChatSidebar
            messages={chatState.messages}
            newMessage={chatState.newMessage}
            setNewMessage={chatState.setNewMessage}
            sendMessage={chatState.sendMessage}
            onArtifactClick={handleArtifactClick}
            isThinking={chatState.isThinking}
            contextItems={chatState.contextItems}
            removeContextItem={chatState.removeContextItem}
            chatMode={chatState.chatMode}
            toggleChatMode={chatState.toggleChatMode}
          />
        </div>
      )}
    </div>
  );
}

export default App;
