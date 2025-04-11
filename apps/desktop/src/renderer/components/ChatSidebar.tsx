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
}) => {
  const [ellipsis, setEllipsis] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hoveredContextId, setHoveredContextId] = useState<string | null>(null);

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
    let queryDisplay = contextItem.title;
    let timeRangeDisplay = "";
    let pageCursorInfo = "";

    // Extract specific details for log context items
    if (
      contextItem.type === "log" &&
      typeof contextItem.data === "object" &&
      contextItem.data !== null
    ) {
      const logParams = contextItem.data as any;
      if (logParams.query) {
        queryDisplay = logParams.query;
      }

      if (logParams.start && logParams.end) {
        timeRangeDisplay = formatTimeRange(logParams.start, logParams.end);
      }

      if (logParams.pageCursor) {
        pageCursorInfo = `Page: ${logParams.pageCursor.substring(0, 6)}...`;
      }
    }

    return (
      <div
        key={contextItem.id}
        className="context-card"
        onMouseEnter={() => setHoveredContextId(contextItem.id)}
        onMouseLeave={() => setHoveredContextId(null)}
      >
        <div className="context-card-content">
          <div className={`context-type ${contextItem.type}`}>{contextItem.type}</div>
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
  };

  const renderArtifactCard = (artifact: Artifact): JSX.Element => {
    const handleClick = () => {
      onArtifactClick(artifact);
    };

    let displayInfo = "";

    // For log artifacts
    if (artifact.type === "log" && typeof artifact.data === "object" && artifact.data !== null) {
      const logParams = artifact.data as any;

      // Display time range if available
      if (logParams.start && logParams.end) {
        displayInfo = formatTimeRange(logParams.start, logParams.end);
      }

      // Add page cursor info if available
      if (logParams.pageCursor) {
        displayInfo += displayInfo
          ? ` • Page ${logParams.pageCursor.substring(0, 6)}...`
          : `Page: ${logParams.pageCursor.substring(0, 6)}...`;
      }
    }

    // For code artifacts
    else if (artifact.type === "code" && artifact.data) {
      // If data is a Map or object with entries, show info about the files
      if (artifact.data instanceof Map) {
        const fileCount = artifact.data.size;
        const files = Array.from(artifact.data.keys());
        if (fileCount === 1) {
          displayInfo = files[0];
        } else {
          displayInfo = `${fileCount} files: ${files[0]}${fileCount > 1 ? `, ...` : ""}`;
        }
      } else if (typeof artifact.data === "object") {
        const keys = Object.keys(artifact.data);
        if (keys.length === 1) {
          displayInfo = keys[0];
        } else if (keys.length > 1) {
          displayInfo = `${keys.length} files: ${keys[0]}${keys.length > 1 ? `, ...` : ""}`;
        }
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
          {artifact.type === "log" &&
            typeof artifact.data === "object" &&
            artifact.data !== null &&
            (artifact.data as any).query && (
              <div title={(artifact.data as any).query}>{(artifact.data as any).query}</div>
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
        <textarea
          className="chat-input"
          placeholder="Message Claude..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isThinking}
        />
        <button
          className="send-button"
          onClick={sendMessage}
          disabled={!newMessage.trim() || isThinking}
        >
          →
        </button>
      </div>
    </>
  );
};

export default ChatSidebar;
