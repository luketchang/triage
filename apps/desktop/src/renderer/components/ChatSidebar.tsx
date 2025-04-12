import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Artifact, ChatMessage, ContextItem } from "../types";

interface ChatSidebarProps {
  messages: ChatMessage[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  sendMessage: () => Promise<void>;
  onArtifactClick: (artifact: Artifact) => void;
  isThinking: boolean;
  contextItems?: ContextItem[];
  removeContextItem?: (id: string) => void;
  chatMode?: "agent" | "manual";
  toggleChatMode?: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  messages,
  newMessage,
  setNewMessage,
  sendMessage,
  onArtifactClick,
  isThinking,
  contextItems = [],
  removeContextItem,
  chatMode = "agent",
  toggleChatMode,
}) => {
  const [ellipsis, setEllipsis] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hoveredContextId, setHoveredContextId] = useState<string | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localMode, setLocalMode] = useState<"agent" | "manual">(chatMode);

  useEffect(() => {
    setLocalMode(chatMode);
  }, [chatMode]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to match design (28px)
    textarea.style.height = "28px";

    // Set to scrollHeight if content exceeds single line
    const scrollHeight = textarea.scrollHeight;
    if (scrollHeight > 28) {
      const newHeight = Math.min(150, scrollHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [newMessage]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Animate ellipsis for the "Thinking..." message
  useEffect(() => {
    if (!isThinking) return;

    const interval = setInterval(() => {
      setEllipsis((prev) => {
        if (prev === "...") return "";
        if (prev === "..") return "...";
        if (prev === ".") return "..";
        return ".";
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isThinking]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim()) {
        sendMessage();
      }
    }
  };

  // Toggle mode selection dropdown
  const toggleModeMenu = () => {
    setModeMenuOpen((prev) => !prev);
  };

  // Set mode and close menu
  const setMode = (mode: "agent" | "manual") => {
    // Update local state immediately for UI
    setLocalMode(mode);

    // Only trigger change if needed and handler exists
    if (chatMode !== mode && toggleChatMode) {
      // Call the actual toggle function to update parent state
      toggleChatMode();
    }

    setModeMenuOpen(false);
  };

  // Format timestamp range in a compact way
  const formatTimeRange = (start: string, end: string): string => {
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);

      // Same day formatting
      if (startDate.toDateString() === endDate.toDateString()) {
        return `${startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      }

      // Different days
      return `${startDate.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    } catch (e) {
      return "Invalid time range";
    }
  };

  // Render a context item card
  const renderContextCard = (contextItem: ContextItem): JSX.Element => {
    // Only handling LogSearchContextItem for now, since it's the only type in our union
    if (contextItem.type === "logSearch") {
      let queryDisplay = contextItem.title;
      let timeRangeDisplay = "";
      let pageCursorInfo = "";

      // Extract details from LogSearchPair
      const logSearchInput = contextItem.data.input;

      if (logSearchInput.query) {
        queryDisplay = logSearchInput.query;
      }

      if (logSearchInput.start && logSearchInput.end) {
        timeRangeDisplay = formatTimeRange(logSearchInput.start, logSearchInput.end);
      }

      if (logSearchInput.pageCursor) {
        pageCursorInfo = `Page: ${logSearchInput.pageCursor.substring(0, 6)}...`;
      }

      return (
        <div
          key={contextItem.id}
          className="context-card"
          onMouseEnter={() => setHoveredContextId(contextItem.id)}
          onMouseLeave={() => setHoveredContextId(null)}
        >
          <div className="context-card-content">
            <div className="context-type">logs</div>
            <div className="context-title" title={queryDisplay}>
              {queryDisplay}
            </div>
            {timeRangeDisplay && <div className="context-time-range">{timeRangeDisplay}</div>}
            {pageCursorInfo && <div className="context-page-cursor">{pageCursorInfo}</div>}
          </div>
          {hoveredContextId === contextItem.id && removeContextItem && (
            <button
              className="remove-context-button"
              onClick={(e) => {
                e.stopPropagation();
                removeContextItem(contextItem.id);
              }}
              title="Remove this context"
            >
              ×
            </button>
          )}
        </div>
      );
    }

    // Default fallback - should never reach here due to discriminated union
    return (
      <div className="context-card">
        <div className="context-card-content">
          <div className="context-title">Unknown context type</div>
        </div>
      </div>
    );
  };

  const renderArtifactCard = (artifact: Artifact): JSX.Element => {
    const handleClick = () => {
      onArtifactClick(artifact);
    };

    let displayInfo = "";

    // Use discriminated union pattern for type-safe handling
    if (artifact.type === "log") {
      const input = artifact.data.input;

      // Display time range if available
      if (input.start && input.end) {
        displayInfo = formatTimeRange(input.start, input.end);
      }

      // Add page cursor info if available
      if (input.pageCursor) {
        displayInfo += displayInfo
          ? ` • Page ${input.pageCursor.substring(0, 6)}...`
          : `Page: ${input.pageCursor.substring(0, 6)}...`;
      }
    } else if (artifact.type === "code") {
      // For code artifacts
      const codeMap = artifact.data;

      // If data is a Map with entries, show info about the files
      const fileCount = codeMap.size;
      const files = Array.from(codeMap.keys());

      if (fileCount === 1) {
        displayInfo = files[0];
      } else {
        displayInfo = `${fileCount} files: ${files[0]}${fileCount > 1 ? `, ...` : ""}`;
      }
    }

    return (
      <div key={artifact.id} className="artifact-card" onClick={handleClick}>
        <div className="artifact-header">
          <div className="artifact-title" title={artifact.title}>
            {artifact.title}
          </div>
          <div className={`artifact-type ${artifact.type}`}>{artifact.type}</div>
        </div>
        <div className="artifact-query">
          {artifact.type === "log" && (
            <div title={artifact.data.input.query}>{artifact.data.input.query}</div>
          )}
        </div>
        {displayInfo && <div className="artifact-details">{displayInfo}</div>}
      </div>
    );
  };

  // Function to render message content with animated ellipsis for "Thinking..."
  const renderMessageContent = (message: ChatMessage) => {
    if (message.content === "Thinking...") {
      return <div className="thinking-message">Thinking{ellipsis}</div>;
    }

    return (
      <>
        <ReactMarkdown>{message.content}</ReactMarkdown>
        {message.artifacts && message.artifacts.length > 0 && (
          <div className="artifacts-container">
            <h4>Generated Artifacts</h4>
            {message.artifacts.map((artifact) => renderArtifactCard(artifact))}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h3>AI Assistant</h3>
            <p>Hello! How can I help you with your application?</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={`chat-message ${message.role}`}>
                <div className="message-header">
                  <div className="message-avatar">{message.role === "user" ? "You" : "AI"}</div>
                  <div className="message-role">{message.role === "user" ? "You" : "Claude"}</div>
                </div>
                <div className="message-content">{renderMessageContent(message)}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chat-input-container">
        {contextItems.length > 0 && (
          <div className="context-items-container">
            <div className="context-items-header">
              <span>Current Context</span>
              <span className="context-keyboard-shortcut">Add more with ⌘+U</span>
            </div>
            <div className="context-items-list">
              {contextItems.map((item) => renderContextCard(item))}
            </div>
          </div>
        )}

        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="message-input"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            disabled={isThinking}
            rows={1}
          />
        </div>

        <div className="message-controls">
          <div className="mode-dropdown">
            <button className="mode-selector-button" onClick={toggleModeMenu}>
              <span className="current-mode">{localMode === "agent" ? "Agent" : "Manual"}</span>
              <span className="dropdown-arrow">▼</span>
            </button>

            {modeMenuOpen && (
              <div className="mode-menu">
                <div
                  className={`mode-option ${localMode === "agent" ? "active" : ""}`}
                  onClick={() => setMode("agent")}
                >
                  Agent
                </div>
                <div
                  className={`mode-option ${localMode === "manual" ? "active" : ""}`}
                  onClick={() => setMode("manual")}
                >
                  Manual
                </div>
              </div>
            )}
          </div>

          <button
            className="send-button"
            onClick={sendMessage}
            disabled={isThinking || !newMessage.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
};

export default ChatSidebar;
