import React, { useEffect, useRef, useState } from "react";

// Define the types for our application
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Artifact {
  id: string;
  type: "code" | "log";
  title: string;
  content: string;
}

interface AppState {
  repoPath: string;
  chatInput: string;
  chatHistory: ChatMessage[];
  artifacts: Artifact[];
  status: "idle" | "loading" | "success" | "error";
  activeArtifactId: string | null;
  error: string | null;
}

// Define the type for the window.api global
declare global {
  interface Window {
    api: {
      invokeAgent?: (
        issue: string,
        repoPath: string
      ) => Promise<{
        success: boolean;
        chatHistory?: string[];
        rootCauseAnalysis?: string | null;
        logPostprocessing?: any;
        codePostprocessing?: any;
        error?: string;
      }>;
      getCurrentDirectory?: () => Promise<string>;
      getPath?: (name: string) => Promise<string>;
      getSystemInfo?: () => {
        platform: string;
        arch: string;
        nodeVersion: string;
        electronVersion: string;
        userAgent: string;
      };
    };
  }
}

const App: React.FC = () => {
  // Component state
  const [state, setState] = useState<AppState>({
    repoPath: "",
    chatInput: "",
    chatHistory: [],
    artifacts: [],
    status: "idle",
    activeArtifactId: null,
    error: null,
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Set default repository path on component mount
  useEffect(() => {
    console.log("App component mounted");
    const fetchDirectory = async () => {
      if (window.api && window.api.getCurrentDirectory) {
        try {
          const currentDir = await window.api.getCurrentDirectory();
          console.log("Current directory:", currentDir);
          setState((prev) => ({
            ...prev,
            repoPath: currentDir || "",
          }));
        } catch (error) {
          console.error("Error getting current directory:", error);
        }
      } else {
        console.log("API not available or getCurrentDirectory not found");
      }
    };

    fetchDirectory();

    // Log system info for debugging
    if (window.api && window.api.getSystemInfo) {
      console.log("System info:", window.api.getSystemInfo());
    }
  }, []);

  // Auto-scroll chat to bottom when messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [state.chatHistory]);

  // Handle chat input changes
  const handleChatInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState((prev) => ({
      ...prev,
      chatInput: e.target.value,
    }));
  };

  // Handle the submit of a chat message
  const handleSubmit = async () => {
    if (!state.chatInput.trim()) return;

    console.log("Submitting message:", state.chatInput);

    // Add user message to chat history
    const userMessage: ChatMessage = {
      role: "user",
      content: state.chatInput,
    };

    setState((prev) => ({
      ...prev,
      chatHistory: [...prev.chatHistory, userMessage],
      chatInput: "",
      status: "loading",
    }));

    try {
      // Call the agent if available
      if (window.api && window.api.invokeAgent) {
        console.log("Invoking agent with message:", userMessage.content);
        const result = await window.api.invokeAgent(userMessage.content, state.repoPath);

        if (result.success) {
          // Add assistant response to chat history
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content:
              result.rootCauseAnalysis || "Analysis complete. Please check the artifacts panel.",
          };

          // Create artifacts from the results
          let newArtifacts: Artifact[] = [];

          // Create log artifact if present
          if (result.logPostprocessing) {
            newArtifacts.push({
              id: `log-${Date.now()}`,
              type: "log",
              title: "Log Analysis",
              content:
                typeof result.logPostprocessing === "string"
                  ? result.logPostprocessing
                  : JSON.stringify(result.logPostprocessing, null, 2),
            });
          }

          // Create code artifact if present
          if (result.codePostprocessing) {
            newArtifacts.push({
              id: `code-${Date.now()}`,
              type: "code",
              title: "Code Analysis",
              content:
                typeof result.codePostprocessing === "string"
                  ? result.codePostprocessing
                  : JSON.stringify(result.codePostprocessing, null, 2),
            });
          }

          // Update state with new artifacts and set active artifact
          setState((prev) => ({
            ...prev,
            chatHistory: [...prev.chatHistory, assistantMessage],
            artifacts: [...prev.artifacts, ...newArtifacts],
            activeArtifactId: newArtifacts.length > 0 ? newArtifacts[0].id : prev.activeArtifactId,
            status: "success",
          }));
        } else {
          // Handle error
          setState((prev) => ({
            ...prev,
            status: "error",
            error: result.error || "An unknown error occurred",
          }));
        }
      } else {
        // If invokeAgent is not available, simulate a simple response
        console.log("Agent API not available, simulating response");
        setTimeout(() => {
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: "I'm sorry, the agent API is not available. This is a simulated response.",
          };

          setState((prev) => ({
            ...prev,
            chatHistory: [...prev.chatHistory, assistantMessage],
            status: "success",
          }));
        }, 1000);
      }
    } catch (error) {
      console.error("Error handling submission:", error);
      setState((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  // Handle Enter key for message submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle clicking on an artifact to display it
  const handleArtifactClick = (artifactId: string) => {
    setState((prev) => ({
      ...prev,
      activeArtifactId: artifactId,
    }));
  };

  // Render a chat message
  const renderChatMessage = (message: ChatMessage, index: number) => {
    return (
      <div
        key={index}
        className={`chat-message ${message.role === "user" ? "user-message" : "assistant-message"}`}
      >
        <div className="message-avatar">{message.role === "user" ? "U" : "A"}</div>
        <div className="message-content">{message.content}</div>
      </div>
    );
  };

  // Render the active artifact content
  const renderArtifactContent = () => {
    if (!state.activeArtifactId) {
      return <div className="no-artifact">No artifact selected</div>;
    }

    const artifact = state.artifacts.find((a) => a.id === state.activeArtifactId);
    if (!artifact) {
      return <div className="no-artifact">Artifact not found</div>;
    }

    return (
      <div className="artifact-content">
        <div className="artifact-title">{artifact.title}</div>
        <pre className={`artifact-code ${artifact.type}`}>{artifact.content}</pre>
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Left Panel - Chat Interface */}
      <div className="chat-panel">
        <div className="app-header">
          <h1>Triage Agent</h1>
        </div>

        {/* Chat Messages */}
        <div className="chat-container" ref={chatContainerRef}>
          {state.chatHistory.length === 0 ? (
            <div className="empty-chat">
              <p>Welcome to Triage Agent! Describe your issue to get started.</p>
              <p>Repository: {state.repoPath || "Loading..."}</p>
            </div>
          ) : (
            state.chatHistory.map(renderChatMessage)
          )}
          {state.status === "loading" && (
            <div className="loading-indicator">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="chat-input-container">
          <textarea
            ref={chatInputRef}
            className="chat-input"
            placeholder="Describe your issue..."
            value={state.chatInput}
            onChange={handleChatInputChange}
            onKeyDown={handleKeyDown}
            disabled={state.status === "loading"}
          />
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={state.status === "loading" || !state.chatInput.trim()}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>

      {/* Right Panel - Artifacts Display */}
      <div className="artifacts-panel">
        <div className="artifacts-header">
          <div className="view-controls">
            <button className="view-button active">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              >
                <path d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
            <button className="view-button">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
            </button>
            <button className="view-button">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            </button>
          </div>
        </div>

        {/* Artifacts List */}
        <div className="artifacts-list">
          {state.artifacts.length === 0 ? (
            <div className="no-artifacts">No artifacts available yet</div>
          ) : (
            state.artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className={`artifact-item ${state.activeArtifactId === artifact.id ? "active" : ""}`}
                onClick={() => handleArtifactClick(artifact.id)}
              >
                <div className="artifact-icon">
                  {artifact.type === "code" ? (
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    >
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  )}
                </div>
                <div className="artifact-name">{artifact.title}</div>
              </div>
            ))
          )}
        </div>

        {/* Artifact Content */}
        <div className="artifact-content-container">{renderArtifactContent()}</div>
      </div>
    </div>
  );
};

export default App;
