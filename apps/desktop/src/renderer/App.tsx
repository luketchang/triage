import { useEffect, useState } from "react";
import "./electron.d";
import "./styles.css";

import { Artifact, ChatMessage, ContextItem, LogSearchParams, TabType } from "./types";
import { generateId } from "./utils/formatters";

// Components
import ChatSidebar from "./components/ChatSidebar";

// Feature Views
import CodeView from "./features/CodeView";
import DashboardsView from "./features/DashboardsView";
import LogsView from "./features/LogsView";
import TracesView from "./features/TracesView";

// Icons
import { ChatIcon, CodeIcon, DashboardsIcon, LogsIcon, TracesIcon } from "./icons";

// Import mock API for testing
import { PostprocessedLogSearchInput } from "@triage/agent";
import { LogsWithPagination } from "@triage/observability";
import api from "./services/api";

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>("logs");
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [logQuery, setLogQuery] = useState<string>("");
  const [timeRange, setTimeRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const [pageCursor, setPageCursor] = useState<string | undefined>(undefined);

  // Handle keyboard shortcuts for toggling the chat sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Command+I (Mac) to toggle chat sidebar
      if (e.metaKey && e.key === "i") {
        e.preventDefault();
        setIsChatSidebarOpen((prev) => !prev);
      }

      // Check for Command+U (Mac) to add current view context to chat
      if (e.metaKey && e.key === "u") {
        e.preventDefault();
        addCurrentContextToChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, logQuery, timeRange, pageCursor]);

  // Add current view context to chat sidebar
  const addCurrentContextToChat = (): void => {
    let newContextItem: ContextItem | null = null;

    switch (activeTab) {
      case "logs":
        // Create context from logs view
        if (logQuery) {
          newContextItem = {
            id: generateId(),
            type: "log",
            title: logQuery || "Log Query",
            description: `Time: ${new Date(timeRange.start).toLocaleString()} - ${new Date(timeRange.end).toLocaleString()}`,
            data: {
              query: logQuery,
              start: timeRange.start,
              end: timeRange.end,
              pageCursor: pageCursor,
              searchParams: { query: logQuery, start: timeRange.start, end: timeRange.end },
            },
            sourceTab: "logs",
          };
        }
        break;
      case "traces":
        // Create context from traces view (will be implemented later)
        break;
      case "code":
        // Create context from code view (will be implemented later)
        break;
      case "dashboards":
        // Create context from dashboards view (will be implemented later)
        break;
    }

    if (newContextItem) {
      setContextItems((prev) => [...prev, newContextItem!]);

      // Open chat sidebar if it's closed
      if (!isChatSidebarOpen) {
        setIsChatSidebarOpen(true);
      }
    }
  };

  // Remove context item from chat
  const removeContextItem = (id: string): void => {
    setContextItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);

    // If an artifact was clicked and is related to the tab type, populate the view
    if (selectedArtifact) {
      if (tab === "logs" && selectedArtifact.type === "log") {
        // Show logs in the logs view
        console.info("Populating logs view with artifact data");
      } else if (tab === "code" && selectedArtifact.type === "code") {
        // Show code in the code view
        console.info("Populating code view with artifact data");
      }
    }
  };

  const toggleChatSidebar = () => {
    setIsChatSidebarOpen(!isChatSidebarOpen);
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

  // Helper function to convert log context to Artifact array
  const createLogArtifacts = (
    logPostprocessing: Map<PostprocessedLogSearchInput, LogsWithPagination | string>
  ): Artifact[] => {
    if (!logPostprocessing) {
      return [];
    }

    const artifacts: Artifact[] = [];

    // Check if we're dealing with a Map
    logPostprocessing.forEach((value, key) => {
      if (value && key) {
        // Create a log search artifact with just the query and time range info
        const logParams: LogSearchParams = {
          query: key.query,
          start: key.start,
          end: key.end,
          searchParams: key,
        };

        // Use key.title if available (for future implementation) or fallback to query
        const artifactTitle = key.title || "Log Analysis";

        artifacts.push({
          id: generateId(),
          type: "log",
          title: artifactTitle,
          description: key.summary || "Log data summary",
          data: logParams,
        });
      }
    });

    return artifacts;
  };

  // Helper function to convert code context to Artifact array
  const createCodeArtifacts = (codePostprocessing: any): Artifact[] => {
    if (!codePostprocessing) {
      return [];
    }

    const artifacts: Artifact[] = [];
    const codeMap = new Map<string, string>();

    // Check if we're dealing with a Map
    if (codePostprocessing instanceof Map) {
      codePostprocessing.forEach((value: string, key: string) => {
        codeMap.set(key, value);
      });
    }
    // Check if it's a plain object (JSON)
    else if (typeof codePostprocessing === "object" && codePostprocessing !== null) {
      Object.entries(codePostprocessing).forEach(([key, value]) => {
        if (typeof value === "string") {
          codeMap.set(key, value);
        } else if (value !== null && typeof value === "object") {
          codeMap.set(key, JSON.stringify(value, null, 2));
        }
      });
    }

    if (codeMap.size > 0) {
      artifacts.push({
        id: generateId(),
        type: "code",
        title: "Code Analysis",
        description: "Code snippets",
        data: codeMap,
      });
    }

    return artifacts;
  };

  const sendMessage = async (): Promise<void> => {
    if (!newMessage.trim()) return;

    // Create a new user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: newMessage,
    };

    // Update the messages state
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    // Clear the input field
    setNewMessage("");

    // Show thinking message
    setIsThinking(true);
    const thinkingMessageId = generateId();
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        id: thinkingMessageId,
        role: "assistant",
        content: "Thinking...",
      },
    ]);

    try {
      // TODO: Add contextItems to the API call when sending the message
      // For now, we're just clearing the context items after sending

      // Invoke the agent with the user's query
      const agentResponse = await api.invokeAgent(newMessage);
      console.info("Agent response:", agentResponse);

      // Remove the thinking message
      setIsThinking(false);
      setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== thinkingMessageId));

      // Clear context items after sending
      setContextItems([]);

      // Extract artifacts from response
      let logArtifacts: Artifact[] = [];
      let codeArtifacts: Artifact[] = [];

      if (agentResponse.data) {
        logArtifacts = createLogArtifacts(agentResponse.data.logPostprocessing);
        codeArtifacts = createCodeArtifacts(agentResponse.data.codePostprocessing);
        console.info("Created log artifacts:", logArtifacts);
        console.info("Created code artifacts:", codeArtifacts);
      }

      const artifacts = [...logArtifacts, ...codeArtifacts];

      // Create a response message with artifacts
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: agentResponse.data?.chatHistory?.join("\n\n") || "I processed your request.",
        artifacts: artifacts.length > 0 ? artifacts : undefined,
      };

      // Update messages with the assistant's response
      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error("Error sending message to agent:", error);

      // Remove the thinking message
      setIsThinking(false);
      setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== thinkingMessageId));

      // Add an error message if the agent invocation fails
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "Sorry, I encountered an error processing your request.",
      };

      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "logs":
        return (
          <LogsView
            selectedArtifact={
              selectedArtifact && selectedArtifact.type === "log" ? selectedArtifact : null
            }
            setLogQuery={setLogQuery}
            setTimeRange={setTimeRange}
            setPageCursor={setPageCursor}
          />
        );
      case "traces":
        return (
          <TracesView
            selectedArtifact={
              selectedArtifact && selectedArtifact.type === "trace" ? selectedArtifact : null
            }
          />
        );
      case "dashboards":
        return (
          <DashboardsView
            selectedArtifact={
              selectedArtifact &&
              (selectedArtifact.type === "dashboard" || selectedArtifact.type === "image")
                ? selectedArtifact
                : null
            }
          />
        );
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
            selectedArtifact={null}
            setLogQuery={setLogQuery}
            setTimeRange={setTimeRange}
            setPageCursor={setPageCursor}
          />
        );
    }
  };

  return (
    <div
      className={`app-container observability-layout ${isChatSidebarOpen ? "with-chat-sidebar" : ""}`}
    >
      {/* Vertical Navigation Sidebar */}
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
            {contextItems.length > 0 && <div className="context-count">{contextItems.length}</div>}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content-wrapper">{renderMainContent()}</div>

      {/* Chat Sidebar */}
      {isChatSidebarOpen && (
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h3>AI Assistant</h3>
            <button
              className="close-chat-button"
              onClick={toggleChatSidebar}
              title="Close Chat (⌘ + I)"
            >
              ×
            </button>
          </div>
          <ChatSidebar
            messages={messages}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            sendMessage={sendMessage}
            onArtifactClick={handleArtifactClick}
            isThinking={isThinking}
            contextItems={contextItems}
            removeContextItem={removeContextItem}
          />
        </div>
      )}
    </div>
  );
}

export default App;
