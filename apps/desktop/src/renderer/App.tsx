import { useState } from "react";
import ReactMarkdown from "react-markdown";
import "./electron.d";
import "./styles-chat-sidebar.css";
import "./styles-chat.css";
import "./styles.css";

import { Artifact } from "./types";

// Custom hooks
import { useChat } from "./hooks/useChat";

function App(): JSX.Element {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  // Use custom hooks
  const chatState = useChat();

  const handleArtifactClick = (artifact: Artifact): void => {
    setSelectedArtifact(artifact);
  };

  return (
    <div className="app-container chat-only-layout">
      <div className="chat-main-content">
        <div className="chat-header">
          <div className="logo-container">
            <div className="logo">Triage</div>
          </div>
        </div>

        <div className="chat-messages">
          {chatState.messages.length === 0 ? (
            <div className="empty-chat">
              <div className="empty-chat-message">
                Start a conversation to trigger an investigation
              </div>
            </div>
          ) : (
            chatState.messages.map((message) => (
              <div
                key={message.id}
                className={`chat-message ${message.role === "user" ? "user" : "assistant-message"}`}
              >
                <div className="message-content">
                  {message.contextItems && message.contextItems.length > 0 && (
                    <div className="message-context-items">
                      <div className="context-items-header">
                        <span>Input Context</span>
                      </div>
                      <div className="context-items-attached">
                        {message.contextItems.map((contextItem) => (
                          <div key={contextItem.id} className="context-card">
                            <div className="context-card-content">
                              <div className="context-type">{contextItem.type}</div>
                              <div className="context-title" title={contextItem.title}>
                                {contextItem.title}
                              </div>
                              <div className="context-page-cursor">{contextItem.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {message.content === "Thinking..." ? (
                    <div className="thinking-message">
                      Thinking{chatState.isThinking ? "..." : ""}
                    </div>
                  ) : message.role === "assistant" ? (
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  ) : (
                    message.content.split("\n").map((line, i) => <p key={i}>{line}</p>)
                  )}
                </div>

                {message.artifacts && message.artifacts.length > 0 && (
                  <div className="artifacts-container">
                    <h4>Artifacts</h4>
                    <div className="artifacts-list">
                      {message.artifacts.map((artifact) => (
                        <div
                          key={artifact.id}
                          className="artifact-card"
                          onClick={() => handleArtifactClick(artifact)}
                        >
                          <div className="artifact-header">
                            <div className={`artifact-type ${artifact.type}`}>{artifact.type}</div>
                            <div className="artifact-title">{artifact.title}</div>
                          </div>
                          {artifact.description && (
                            <div className="artifact-details">{artifact.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="chat-input-container">
          {chatState.contextItems.length > 0 && (
            <div className="context-items-container">
              <div className="context-items-header">
                <span>Input Context</span>
              </div>
              <div className="context-items-list">
                {chatState.contextItems.map((contextItem) => (
                  <div key={contextItem.id} className="context-card">
                    <div className="context-card-content">
                      <div className="context-type">{contextItem.type}</div>
                      <div className="context-title" title={contextItem.title}>
                        {contextItem.title}
                      </div>
                      <div className="context-time-range">{contextItem.description}</div>
                    </div>
                    <button
                      className="remove-context-button"
                      onClick={() => chatState.removeContextItem(contextItem.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              value={chatState.newMessage}
              onChange={(e) => chatState.setNewMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={chatState.isThinking}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (chatState.newMessage.trim()) {
                    chatState.sendMessage();
                  }
                }
              }}
            />
            <button
              className="send-button orange-submit-button"
              onClick={() => chatState.sendMessage()}
              disabled={chatState.isThinking || !chatState.newMessage.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
