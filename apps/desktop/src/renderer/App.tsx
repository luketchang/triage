import { useEffect, useState } from "react";
import "./styles.css";
import { Artifact, ChatMessage, TabType } from "./types";
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

// Make TypeScript aware of our electron API
// No need to import, but TS will pick up the global augmentation
import "./electron.d";
import { FacetData, LogQueryParams } from "./electron.d";

// Import mock API for testing
import mockElectronAPI from "./electronApiMock";
import api from "./services/api";

// TESTING ONLY: Set to true to use mock API instead of real Electron API
// Set to false in production or when testing with the real API
const USE_MOCK_API = true; // Changed to true to load mock data

// Define the AgentConfig interface
interface AgentConfig {
  repoPath: string;
  codebaseOverviewPath: string;
  observabilityPlatform: string;
  observabilityFeatures: string[];
  startDate: Date;
  endDate: Date;
}

// Create a wrapper API that will use either the real or mock API
const apiWrapper = {
  invokeAgent: async (query: string) => {
    if (USE_MOCK_API) {
      console.info("Using mock invokeAgent");
      return mockElectronAPI.invokeAgent(query);
    } else {
      return window.electronAPI.invokeAgent(query);
    }
  },
  getAgentConfig: async () => {
    if (USE_MOCK_API) {
      console.info("Using mock getAgentConfig");
      return mockElectronAPI.getAgentConfig();
    } else {
      return window.electronAPI.getAgentConfig();
    }
  },
  updateAgentConfig: async (newConfig: Partial<AgentConfig>) => {
    if (USE_MOCK_API) {
      console.info("Using mock updateAgentConfig");
      return mockElectronAPI.updateAgentConfig(newConfig);
    } else {
      return window.electronAPI.updateAgentConfig(newConfig);
    }
  },
  fetchLogs: async (params: LogQueryParams) => {
    // In a real implementation, this would call the actual observability API
    if (USE_MOCK_API) {
      console.info("Using mock fetchLogs");
      return mockElectronAPI.fetchLogs(params);
    } else {
      // This would be implemented in the actual electron API
      // For now, we'll return mock data
      return mockElectronAPI.fetchLogs(params);
    }
  },
  getLogsFacetValues: async (start: string, end: string) => {
    if (USE_MOCK_API) {
      console.info("Using mock getLogsFacetValues");
      return mockElectronAPI.getLogsFacetValues(start, end);
    } else {
      // This would be implemented in the actual electron API
      // For now, we'll return mock data
      return mockElectronAPI.getLogsFacetValues(start, end);
    }
  },
};

// Define the Log interface for the UI
interface Log {
  timestamp: string;
  message: string;
  service: string;
  level: string;
  attributes?: {
    [key: string]: any;
  };
  metadata?: Record<string, string>;
}

// Type for code artifacts
type CodeMap = Map<string, string>;

// Type for artifact types
type ArtifactType = "code" | "image" | "document" | "log";

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>("logs");
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Log view state
  const [logs, setLogs] = useState<Log[]>([]);
  const [logQuery, setLogQuery] = useState<string>("");
  const [timeRange, setTimeRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
    end: new Date().toISOString(), // now
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [facets, setFacets] = useState<FacetData[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [pageCursor, setPageCursor] = useState<string | undefined>(undefined);
  const [queryLimit] = useState<number>(100); // Default limit for number of logs

  // Time range presets
  const timeRangePresets = [
    { label: "Last 15 minutes", value: 15 * 60 * 1000 },
    { label: "Last hour", value: 60 * 60 * 1000 },
    { label: "Last 6 hours", value: 6 * 60 * 60 * 1000 },
    { label: "Last 24 hours", value: 24 * 60 * 60 * 1000 },
    { label: "Last 7 days", value: 7 * 24 * 60 * 60 * 1000 },
  ];

  // Handle keyboard shortcuts for toggling the chat sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Command+I (Mac) to toggle chat sidebar
      if (e.metaKey && e.key === "i") {
        e.preventDefault();
        setIsChatSidebarOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Sample artifacts for development (would normally be dynamically generated)
  const sampleArtifacts: Artifact[] = [
    {
      id: "1",
      type: "code",
      title: "Fibonacci Sequence Generator",
      description: "Code",
      data: new Map([
        [
          "fibonacci.py",
          `def fibonacci(n):
    """
    Generate the first n numbers in the Fibonacci sequence.
    
    Args:
        n (int): The number of Fibonacci numbers to generate
        
    Returns:
        list: The first n Fibonacci numbers
    """
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    elif n == 2:
        return [0, 1]
        
    fib_sequence = [0, 1]
    for i in range(2, n):
        fib_sequence.append(fib_sequence[i-1] + fib_sequence[i-2])
        
    return fib_sequence

# Example usage
if __name__ == "__main__":
    n = 10
    result = fibonacci(n)
    print(f"The first {n} Fibonacci numbers are: {result}")`,
        ],
      ]),
    },
    {
      id: "2",
      type: "image",
      title: "Simple Bar Chart",
      description: "Image",
      data: "sample_chart.svg",
    },
    {
      id: "3",
      type: "log",
      title: "Error Logs",
      description: "Logs",
      data: [
        {
          timestamp: "2023-04-06T08:30:00Z",
          message: "Failed to connect to database",
          service: "api",
          level: "error",
          attributes: {
            error: "Connection refused",
            attempts: 3,
          },
        },
        {
          timestamp: "2023-04-06T08:31:00Z",
          message: "Retrying database connection",
          service: "api",
          level: "info",
        },
        {
          timestamp: "2023-04-06T08:32:00Z",
          message: "Successfully connected to database",
          service: "api",
          level: "info",
        },
      ],
    },
  ];

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

  const closeArtifactViewer = () => {
    setSelectedArtifact(null);
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

    try {
      // Invoke the agent with the user's query
      const agentResponse = await api.invokeAgent(newMessage);

      // Create a response message with artifacts
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: agentResponse.data?.chatHistory?.join("\n\n") || "I processed your request.",
        artifacts: sampleArtifacts, // Use sample artifacts for testing or extract from response
      };

      // Update messages with the assistant's response
      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error("Error sending message to agent:", error);

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
        return <LogsView selectedArtifact={null} />;
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
          />
        </div>
      )}

      {/* Artifact Viewer - No longer needed as artifacts will be shown in respective tabs */}
      {/* {selectedArtifact && (
        <ArtifactViewer artifact={selectedArtifact} onClose={closeArtifactViewer} />
      )} */}
    </div>
  );
}

export default App;
