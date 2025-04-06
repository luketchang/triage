import { useState } from "react";
import SplitPane from "react-split-pane";
import "./styles.css";
import type { Log } from "@triage/observability/src/types";

// Type for code artifacts
type CodeMap = Map<string, string>;

interface Artifact {
  id: string;
  type: "log" | "code";
  data: Log[] | CodeMap;
  title: string;
}

// Interface for chat messages
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function App(): JSX.Element {
  const [artifacts, setArtifacts] = useState<Artifact[]>([
    // Mock artifacts for development
    {
      id: "1",
      type: "log",
      title: "Error Logs",
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
    {
      id: "2",
      type: "code",
      title: "Database Connection",
      data: new Map([
        [
          "/src/db/connection.ts",
          `import { Pool } from 'pg';\n\nexport const pool = new Pool({\n  host: process.env.DB_HOST,\n  port: parseInt(process.env.DB_PORT || '5432'),\n  user: process.env.DB_USER,\n  password: process.env.DB_PASSWORD,\n  database: process.env.DB_NAME,\n});`,
        ],
      ]),
    },
  ]);

  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [showArtifactSidebar, setShowArtifactSidebar] = useState(true);

  // Mock chat messages for development
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hello! How can I help you with your application?" },
    { role: "user", content: "I'm seeing database connection errors in production" },
    {
      role: "assistant",
      content: "I'll look into that. Let me check the logs and connection code.",
    },
  ]);

  // New message being composed
  const [newMessage, setNewMessage] = useState("");

  const toggleArtifactSidebar = (): void => {
    setShowArtifactSidebar(!showArtifactSidebar);
  };

  const selectArtifact = (id: string): void => {
    setSelectedArtifact(id === selectedArtifact ? null : id);
  };

  const sendMessage = (): void => {
    if (newMessage.trim() === "") return;

    setMessages([...messages, { role: "user", content: newMessage }]);
    setNewMessage("");

    // Mock assistant response after a short delay
    setTimeout(() => {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "assistant",
          content:
            "I'm examining the logs and code to troubleshoot your database connection issue.",
        },
      ]);
    }, 1000);
  };

  const renderLogArtifact = (logs: Log[]): JSX.Element[] => {
    return logs.map((log, index) => (
      <div key={index} className={`log-entry log-level-${log.level}`}>
        <div>
          <span style={{ opacity: 0.7 }}>{new Date(log.timestamp).toLocaleTimeString()}</span>{" "}
          <strong>[{log.service}]</strong> <span>{log.level.toUpperCase()}</span>
        </div>
        <div>{log.message}</div>
        {log.attributes && (
          <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
            {Object.entries(log.attributes).map(([key, value]) => (
              <div key={key}>
                {key}: {JSON.stringify(value)}
              </div>
            ))}
          </div>
        )}
      </div>
    ));
  };

  const renderCodeArtifact = (codeMap: CodeMap): JSX.Element[] => {
    return Array.from(codeMap.entries()).map(([filePath, content], index) => (
      <div key={index} style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: "bold", marginBottom: "0.5rem", opacity: 0.7 }}>{filePath}</div>
        <pre style={{ margin: 0 }}>{content}</pre>
      </div>
    ));
  };

  const renderArtifact = (artifact: Artifact): JSX.Element | null => {
    if (artifact.type === "log") {
      return <>{renderLogArtifact(artifact.data as Log[])}</>;
    } else if (artifact.type === "code") {
      return <>{renderCodeArtifact(artifact.data as CodeMap)}</>;
    }
    return null;
  };

  return (
    <div className="app-container">
      <SplitPane
        split="vertical"
        minSize={200}
        defaultSize={300}
        resizerClassName="vertical-divider"
        className="split-pane-row"
      >
        {/* Chat Sidebar */}
        <div className="chat-sidebar">
          <h2>Triage Chat</h2>
          <div style={{ flex: 1, overflow: "auto" }}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`chat-message ${
                  message.role === "user" ? "user-message" : "assistant-message"
                }`}
              >
                <strong>{message.role === "user" ? "You" : "Assistant"}:</strong>
                <div>{message.content}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
            <textarea
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: "4px",
                backgroundColor: "#333",
                color: "white",
                border: "1px solid #555",
                resize: "vertical",
                minHeight: "60px",
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                marginTop: "0.5rem",
                padding: "0.5rem 1rem",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                width: "100%",
              }}
            >
              Send
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="main-content">
          <SplitPane
            split="vertical"
            minSize={300}
            defaultSize={showArtifactSidebar ? "70%" : "100%"}
            resizerClassName="vertical-divider"
            pane2Style={{ display: showArtifactSidebar ? "block" : "none" }}
          >
            {/* Content area */}
            <div style={{ padding: "1rem", height: "100%", overflow: "auto" }}>
              <h2>Artifacts</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                {artifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className={`artifact-container ${
                      artifact.type === "log" ? "log-artifact" : "code-artifact"
                    }`}
                    style={{
                      cursor: "pointer",
                      width: "calc(50% - 0.5rem)",
                      backgroundColor: selectedArtifact === artifact.id ? "#333" : "transparent",
                    }}
                    onClick={() => selectArtifact(artifact.id)}
                  >
                    <div className="artifact-header">
                      <div>
                        {artifact.type === "log" ? "📋" : "📄"} {artifact.title}
                      </div>
                      <div>
                        {artifact.type === "log"
                          ? `${(artifact.data as Log[]).length} logs`
                          : `${(artifact.data as Map<string, string>).size} files`}
                      </div>
                    </div>
                    <div
                      className="artifact-content"
                      style={{ maxHeight: "100px", overflow: "hidden" }}
                    >
                      {renderArtifact(artifact)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Artifact sidebar */}
            {showArtifactSidebar && (
              <div className="artifact-sidebar">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <h3 style={{ margin: 0 }}>Details</h3>
                  <button
                    onClick={toggleArtifactSidebar}
                    style={{
                      backgroundColor: "transparent",
                      border: "none",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "1.2rem",
                    }}
                  >
                    ×
                  </button>
                </div>

                {selectedArtifact ? (
                  <div>
                    {artifacts
                      .filter((a) => a.id === selectedArtifact)
                      .map((artifact) => (
                        <div key={artifact.id}>
                          <h3>{artifact.title}</h3>
                          <div className="artifact-content" style={{ maxHeight: "none" }}>
                            {renderArtifact(artifact)}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div style={{ opacity: 0.7 }}>Select an artifact to view details</div>
                )}
              </div>
            )}
          </SplitPane>

          {/* Toggle button for artifact sidebar when closed */}
          {!showArtifactSidebar && (
            <button
              onClick={toggleArtifactSidebar}
              style={{
                position: "absolute",
                right: "0",
                top: "1rem",
                backgroundColor: "#333",
                border: "none",
                borderTopLeftRadius: "4px",
                borderBottomLeftRadius: "4px",
                color: "white",
                padding: "0.5rem",
                cursor: "pointer",
              }}
            >
              ◀ Details
            </button>
          )}
        </div>
      </SplitPane>
    </div>
  );
}

export default App;
