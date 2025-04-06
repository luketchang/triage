import type { Log } from "@triage/observability/src/types";
import { useState } from "react";
import "./styles.css";

// Make TypeScript aware of our electron API
// No need to import, but TS will pick up the global augmentation
import "./electron.d";

// Type for code artifacts
type CodeMap = Map<string, string>;

// Type for artifact types
type ArtifactType = "code" | "image" | "document" | "log";

interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  description: string;
  data: Log[] | CodeMap | string;
}

// Interface for chat messages
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifacts?: Artifact[];
}

function App(): JSX.Element {
  // Sample artifacts for development
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
      data: "sample_chart.svg", // In a real app, this could be a URL or Base64 data
    },
    {
      id: "3",
      type: "log",
      title: "Error Logs",
      description: "Logs",
      data: [
        {
          timestamp: "2025-04-06T08:30:00Z",
          message: "Failed to connect to database",
          service: "api",
          level: "error",
          metadata: { requestId: "req-123" },
        },
        {
          timestamp: "2025-04-06T08:29:50Z",
          message: "Connection timeout",
          service: "api",
          level: "warn",
          metadata: { requestId: "req-123" },
        },
      ],
    },
  ];

  // Mock chat messages for development
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg1",
      role: "assistant",
      content: "Hello! How can I help you with your application?",
    },
    {
      id: "msg2",
      role: "user",
      content: "Can you show me an example of some artifacts?",
    },
    {
      id: "msg3",
      role: "assistant",
      content:
        "I'd be happy to demonstrate how artifacts work! Artifacts are a way to create and reference structured content within our conversation. Let me create an example artifact with some Python code.",
      artifacts: [sampleArtifacts[0]],
    },
    {
      id: "msg4",
      role: "assistant",
      content:
        "I can create other types of artifacts as well. Here's an example of a simple SVG graphic:",
      artifacts: [sampleArtifacts[1]],
    },
    {
      id: "msg5",
      role: "assistant",
      content:
        "These artifacts are useful when you need:\n\n1. Code that you can easily copy and reference\n2. Visual elements like charts, diagrams, or images\n3. Structured documents that benefit from dedicated formatting\n4. Content that you might want to download or reuse outside our conversation",
    },
  ]);

  // New message being composed
  const [newMessage, setNewMessage] = useState("");

  // Currently selected artifact
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  const sendMessage = async (): Promise<void> => {
    if (newMessage.trim() === "") return;

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `msg${messages.length + 1}`,
      role: "user",
      content: newMessage,
    };

    setMessages([...messages, userMessage]);
    setNewMessage("");

    try {
      // Show loading message
      const loadingMessage: ChatMessage = {
        id: `msg${messages.length + 2}`,
        role: "assistant",
        content: "Thinking...",
      };

      setMessages((prev) => [...prev, loadingMessage]);

      // Call the agent API (window.electronAPI is now properly typed)
      const response = await window.electronAPI.invokeAgent(newMessage);

      if (response.success && response.data) {
        // Remove the loading message
        setMessages((prev) => prev.filter((message) => message.id !== loadingMessage.id));

        // Add the agent response to the chat
        const assistantMessage: ChatMessage = {
          id: `msg${messages.length + 2}`,
          role: "assistant",
          content: response.data.chatHistory.join("\n\n") || "No response from agent",
        };

        // Add root cause analysis if available
        if (response.data.rca) {
          assistantMessage.content += `\n\n**Root Cause Analysis:**\n${response.data.rca}`;
        }

        // Add artifacts if available
        const artifacts: Artifact[] = [];

        if (response.data.logPostprocessing) {
          artifacts.push({
            id: `artifact-log-${Date.now()}`,
            type: "log",
            title: "Log Analysis",
            description: "Log postprocessing results",
            data: JSON.stringify(response.data.logPostprocessing),
          });
        }

        if (response.data.codePostprocessing) {
          // Create a code map from the code postprocessing
          const codeMap = new Map<string, string>();
          const codePostprocessing = response.data.codePostprocessing as any;

          if (codePostprocessing.relevantCode) {
            for (const [filePath, content] of Object.entries(codePostprocessing.relevantCode)) {
              codeMap.set(filePath, content as string);
            }
          }

          artifacts.push({
            id: `artifact-code-${Date.now()}`,
            type: "code",
            title: "Code Analysis",
            description: "Code postprocessing results",
            data: codeMap,
          });
        }

        if (artifacts.length > 0) {
          assistantMessage.artifacts = artifacts;
        }

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Remove the loading message
        setMessages((prev) => prev.filter((message) => message.id !== loadingMessage.id));

        // Add error message
        const errorMessage: ChatMessage = {
          id: `msg${messages.length + 2}`,
          role: "assistant",
          content: `Error: ${response.error || "Unknown error"}`,
        };

        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      // Handle any errors
      const errorMessage: ChatMessage = {
        id: `msg${messages.length + 2}`,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };

      // Remove any loading message
      setMessages((prev) => [
        ...prev.filter((message) => !message.content.includes("Thinking...")),
        errorMessage,
      ]);
    }
  };

  const renderArtifactContent = (artifact: Artifact): JSX.Element | null => {
    switch (artifact.type) {
      case "code":
        const codeMap = artifact.data as CodeMap;
        return (
          <div className="artifact-detail-content">
            {Array.from(codeMap.entries()).map(([filePath, content], index) => (
              <div key={index} className="code-file">
                <div className="code-file-header">{filePath}</div>
                <pre className="code-block">{content}</pre>
              </div>
            ))}
          </div>
        );
      case "log":
        const logs = artifact.data as Log[];
        return (
          <div className="artifact-detail-content">
            {logs.map((log, index) => (
              <div key={index} className={`log-entry log-level-${log.level}`}>
                <div>
                  <span className="log-timestamp">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>{" "}
                  <strong>[{log.service}]</strong>{" "}
                  <span className="log-level">{log.level.toUpperCase()}</span>
                </div>
                <div className="log-message">{log.message}</div>
                {log.metadata && (
                  <div className="log-metadata">
                    {Object.entries(log.metadata).map(([key, value]) => (
                      <div key={key}>
                        {key}: {JSON.stringify(value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      case "image":
        return (
          <div className="artifact-detail-content">
            <div className="image-placeholder">
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 200 120"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="20" y="20" width="30" height="80" fill="#e67e22" />
                <rect x="60" y="40" width="30" height="60" fill="#3498db" />
                <rect x="100" y="30" width="30" height="70" fill="#2ecc71" />
                <rect x="140" y="50" width="30" height="50" fill="#9b59b6" />
              </svg>
            </div>
          </div>
        );
      default:
        return <div className="artifact-detail-content">Unsupported artifact type</div>;
    }
  };

  const handleArtifactClick = (artifact: Artifact): void => {
    setSelectedArtifact(selectedArtifact?.id === artifact.id ? null : artifact);
  };

  const renderArtifactCard = (artifact: Artifact): JSX.Element => {
    return (
      <div
        key={artifact.id}
        className="artifact-card"
        onClick={() => handleArtifactClick(artifact)}
      >
        <div className="artifact-card-header">
          <span className="artifact-card-title">{artifact.title}</span>
          <span className="artifact-card-type">{artifact.description}</span>
        </div>
        <div className="artifact-card-preview">
          {artifact.type === "code" && (
            <div className="code-preview">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="preview-icon"
              >
                <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
              </svg>
            </div>
          )}
          {artifact.type === "image" && (
            <div className="image-preview">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="preview-icon"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
          {artifact.type === "log" && (
            <div className="log-preview">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="preview-icon"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <div className={`chat-container ${selectedArtifact ? "with-sidebar" : ""}`}>
        <div className="chat-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${message.role === "user" ? "user-message" : "assistant-message"}`}
            >
              <div className="message-header">
                <div className="avatar">{message.role === "user" ? "LT" : "AI"}</div>
                <div className="message-sender">{message.role === "user" ? "You" : "Claude"}</div>
              </div>
              <div className="message-content">
                {message.content}

                {message.artifacts && message.artifacts.length > 0 && (
                  <div className="artifacts-container">
                    {message.artifacts.map((artifact) => renderArtifactCard(artifact))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="message-input-container">
          <textarea
            className="message-input"
            placeholder="Message Claude..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button className="send-button" onClick={sendMessage}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>

      {selectedArtifact && (
        <div className="artifact-sidebar">
          <div className="artifact-sidebar-header">
            <div className="artifact-sidebar-title">{selectedArtifact.title}</div>
            <button className="close-sidebar-button" onClick={() => setSelectedArtifact(null)}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="artifact-sidebar-content">{renderArtifactContent(selectedArtifact)}</div>
        </div>
      )}
    </div>
  );
}

export default App;
