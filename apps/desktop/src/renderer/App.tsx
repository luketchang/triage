import { useEffect, useState } from "react";
import "./electron.d";
import "./styles.css";

import { Artifact, ChatMessage, LogSearchParams, TabType } from "./types";
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
import api from "./services/api";

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>("logs");
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

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

  // Helper function to convert log context to Artifact array
  const createLogArtifacts = (logPostprocessing: any): Artifact[] => {
    if (!logPostprocessing) {
      return [];
    }

    const artifacts: Artifact[] = [];

    // Check if we're dealing with a Map
    if (logPostprocessing instanceof Map) {
      logPostprocessing.forEach((value, key) => {
        if (value && key) {
          // Create a log search artifact with just the query and time range info
          const logParams: LogSearchParams = {
            query: key.query,
            start: key.start,
            end: key.end,
            searchParams: key,
          };

          artifacts.push({
            id: generateId(),
            type: "log",
            title: key.query || "Log Analysis",
            description: key.reasoning || "Log data",
            data: logParams,
          });
        }
      });
    }
    // Check if it's a plain object (JSON)
    else if (typeof logPostprocessing === "object" && logPostprocessing !== null) {
      // Try to convert the object to a Map-like structure
      Object.entries(logPostprocessing).forEach(([keyStr, value]) => {
        try {
          // Try to parse the key from string
          const key = JSON.parse(keyStr);

          if (value && key) {
            const logParams: LogSearchParams = {
              query: key.query,
              start: key.start,
              end: key.end,
              searchParams: key,
            };

            artifacts.push({
              id: generateId(),
              type: "log",
              title: key.query || "Log Analysis",
              description: key.reasoning || "Log data",
              data: logParams,
            });
          }
        } catch (error) {
          console.error("Error parsing log artifact key:", error);
        }
      });
    }

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
      // Invoke the agent with the user's query
      const agentResponse = await api.invokeAgent(newMessage);
      console.info("Agent response:", agentResponse);

      // Remove the thinking message
      setIsThinking(false);
      setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== thinkingMessageId));

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
            isThinking={isThinking}
          />
        </div>
      )}
    </div>
  );
}

export default App;
