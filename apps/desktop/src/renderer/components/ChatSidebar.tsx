import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Artifact, ChatMessage } from "../types";

interface ChatSidebarProps {
  messages: ChatMessage[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  sendMessage: () => Promise<void>;
  onArtifactClick: (artifact: Artifact) => void;
  isThinking: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  messages,
  newMessage,
  setNewMessage,
  sendMessage,
  onArtifactClick,
  isThinking,
}) => {
  const [ellipsis, setEllipsis] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Format long titles to be more readable
  const formatTitle = (title: string, type: string): string => {
    if (type !== "log") {
      return title.length > 25 ? title.substring(0, 22) + "..." : title;
    }

    // Format log query titles
    if (title.includes("(") && (title.includes(" OR ") || title.includes(" AND "))) {
      return "Log Query";
    }

    // If it's a service filter query
    if (title.startsWith("service:")) {
      return "Service Logs";
    }

    // If it contains error or status
    if (title.includes("error") || title.includes("status:")) {
      return "Error Logs";
    }

    // If title is too long, truncate it
    if (title.length > 25) {
      return title.substring(0, 22) + "...";
    }

    return title;
  };

  // Generate a simplified description for log query
  const getLogDescription = (title: string): string => {
    // For complex queries, try to extract the most important part
    if (title.includes("OR") || title.includes("AND")) {
      const services = [...title.matchAll(/service:([a-z-_]+)/g)].map((match) => match[1]);
      if (services.length > 0) {
        return `Services: ${services.join(", ")}`;
      }

      if (title.includes("status:error")) {
        return "Error logs from services";
      }
    }

    // Default
    return "Click to view matching logs";
  };

  const renderArtifactCard = (artifact: Artifact): JSX.Element => {
    const handleClick = () => {
      onArtifactClick(artifact);
    };

    const title = formatTitle(artifact.title, artifact.type);
    const description =
      artifact.type === "log" ? getLogDescription(artifact.title) : artifact.description;

    return (
      <div key={artifact.id} className="artifact-card" onClick={handleClick}>
        <div className="artifact-header">
          <div className="artifact-title">{title}</div>
          <div className={`artifact-type ${artifact.type}`}>{artifact.type}</div>
        </div>
        <div className="artifact-description">{description}</div>
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
