import { useState } from "react";
import "./electron.d";
import "./styles.css";

// Feature flag for Traces view
const TRACES_ENABLED = window.env.TRACES_ENABLED;

import { Artifact, ContextItem, LogSearchInputCore, TabType, TraceForAgent } from "./types";
import { generateId } from "./utils/formatters";

// Components
import NavigationSidebar from "./components/NavigationSidebar";

// Feature Views
import ChatView from "./features/ChatView";
import DashboardsView from "./features/DashboardsView";
import LogsView from "./features/LogsView";
import TracesView from "./features/TracesView";

// Custom hooks
import { useChat } from "./hooks/useChat";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useLogs } from "./hooks/useLogs";
import { useTraces } from "./hooks/useTraces";

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  // Use custom hooks
  const logsState = useLogs({ shouldFetch: activeTab === "logs" });
  const chatState = useChat();

  // Always use the traces hook, but use the result conditionally
  const tracesHookResult = useTraces({ shouldFetch: activeTab === "traces" && TRACES_ENABLED });
  const tracesState = TRACES_ENABLED
    ? tracesHookResult
    : {
        // Dummy implementation when traces are disabled
        traces: [],
        traceQuery: "",
        setTraceQuery: () => {},
        isLoading: false,
        timeRange: { start: "", end: "" },
        fetchTracesWithQuery: () => {},
        handleLoadMoreTraces: () => {},
        handleTimeRangeChange: () => {},
        facets: [],
        selectedFacets: [],
        setSelectedFacets: () => {},
        selectedTrace: null,
        selectedSpan: null,
        handleTraceSelect: () => {},
        handleSpanSelect: () => {},
        pageCursor: undefined,
        setTraces: () => {},
        setIsLoading: () => {},
        setPageCursor: () => {},
        setSelectedSpan: () => {},
        setTimeRange: () => {},
        processTracesForUI: () => [],
      };

  // Setup keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "u",
      metaKey: true,
      action: () => {
        addCurrentContextToChat();
        // Switch to chat view after adding context
        setActiveTab("chat");
      },
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
    }
  };

  // Add current view context to chat
  const addCurrentContextToChat = async (): Promise<void> => {
    let newContextItem: ContextItem | null = null;

    switch (activeTab) {
      case "logs":
        // Create context from logs view
        // Both logQuery and logsWithPagination should be populated or neither should be
        if (logsState.logQuery && logsState.logsWithPagination) {
          // Create a LogSearchInputCore object
          const logSearchInput: LogSearchInputCore = {
            query: logsState.logQuery,
            start: logsState.timeRange.start,
            end: logsState.timeRange.end,
            limit: 500,
            pageCursor: logsState.pageCursor || null,
            type: "logSearchInput",
          };

          // Use the logs data directly from state - no need to fetch again
          newContextItem = {
            id: generateId(),
            type: "logSearch",
            title: logsState.logQuery || "Log Query",
            description: `Time: ${new Date(logsState.timeRange.start).toLocaleString()} - ${new Date(logsState.timeRange.end).toLocaleString()}`,
            data: {
              input: logSearchInput,
              results: logsState.logsWithPagination,
            },
            sourceTab: "logs",
          };
        } else if (logsState.logQuery) {
          console.warn("Unexpected state: logQuery exists but logsWithPagination is missing");
        } else if (logsState.logsWithPagination) {
          console.warn("Unexpected state: logsWithPagination exists but logQuery is missing");
        }
        break;
      case "traces":
        // Skip adding trace context if traces are disabled
        if (!TRACES_ENABLED) {
          console.info("Traces view is disabled - no context will be added");
          break;
        }

        // Create context from traces view - ONLY if a trace is explicitly selected
        if (tracesState.selectedTrace) {
          console.info("Adding selected trace to context:", tracesState.selectedTrace.traceId);

          // Extract just the necessary properties without serviceBreakdown
          const { serviceBreakdown, ...traceForAgent } = tracesState.selectedTrace;

          // Create a SingleTraceContextItem with the selected trace
          newContextItem = {
            id: generateId(),
            type: "singleTrace",
            title: `Trace: ${tracesState.selectedTrace.rootService} - ${tracesState.selectedTrace.rootResource}`,
            description: `Trace ID: ${tracesState.selectedTrace.traceId}`,
            data: traceForAgent as TraceForAgent,
            sourceTab: "traces",
          };
        } else {
          console.info("No trace selected - cmd+u has no effect in traces view without selection");
        }
        break;
      case "dashboards":
      case "chat":
        // No context to add from these views
        break;
    }

    if (newContextItem) {
      chatState.setContextItems((prev) => [...prev, newContextItem!]);
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "logs":
        return (
          <LogsView
            logs={logsState.logs}
            logsWithPagination={logsState.logsWithPagination}
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
            facets={logsState.facets}
            selectedFacets={logsState.selectedFacets}
            setSelectedFacets={logsState.setSelectedFacets}
          />
        );
      case "traces":
        return TRACES_ENABLED ? (
          <TracesView
            selectedArtifact={
              selectedArtifact && selectedArtifact.type === "trace" ? selectedArtifact : null
            }
            selectedTrace={tracesState.selectedTrace}
            handleTraceSelect={tracesState.handleTraceSelect}
            traces={tracesState.traces}
            traceQuery={tracesState.traceQuery}
            setTraceQuery={tracesState.setTraceQuery}
            isLoading={tracesState.isLoading}
            timeRange={tracesState.timeRange}
            fetchTracesWithQuery={tracesState.fetchTracesWithQuery}
            handleLoadMoreTraces={tracesState.handleLoadMoreTraces}
            handleTimeRangeChange={tracesState.handleTimeRangeChange}
            facets={tracesState.facets}
            selectedFacets={tracesState.selectedFacets}
            setSelectedFacets={tracesState.setSelectedFacets}
            selectedSpan={tracesState.selectedSpan}
            handleSpanSelect={tracesState.handleSpanSelect}
            pageCursor={tracesState.pageCursor}
            setSelectedSpan={tracesState.setSelectedSpan}
          />
        ) : (
          <div className="traces-view">
            <div className="dashboards-placeholder">
              <h2>Traces View</h2>
              <p>Distributed tracing functionality will be implemented in a future update.</p>
            </div>
          </div>
        );
      case "dashboards":
        return <DashboardsView selectedArtifact={null} />;
      case "chat":
        return (
          <ChatView
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
        );
      default:
        return (
          <ChatView
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
        );
    }
  };

  return (
    <div className="app-container observability-layout">
      {/* Vertical Navigation Sidebar */}
      <NavigationSidebar
        activeTab={activeTab}
        handleTabChange={handleTabChange}
        contextItemsCount={chatState.contextItems.length}
      />

      {/* Main Content Area */}
      <div className="main-content-wrapper">{renderMainContent()}</div>
    </div>
  );
}

export default App;
