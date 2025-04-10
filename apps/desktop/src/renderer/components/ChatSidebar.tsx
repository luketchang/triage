import React from "react";
import ReactMarkdown from "react-markdown";
import { Artifact, ChatMessage } from "../types";

interface ChatSidebarProps {
  messages: ChatMessage[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  sendMessage: () => Promise<void>;
  onArtifactClick: (artifact: Artifact) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  messages,
  newMessage,
  setNewMessage,
  sendMessage,
  onArtifactClick,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim()) {
        sendMessage();
      }
    }
  };

  const renderArtifactCard = (artifact: Artifact): JSX.Element => {
    const handleClick = () => {
      onArtifactClick(artifact);
    };

    return (
      <div key={artifact.id} className="artifact-card" onClick={handleClick}>
        <div className="artifact-header">
          <div className="artifact-type">{artifact.type}</div>
          <div className="artifact-title">{artifact.title}</div>
        </div>
        <div className="artifact-description">{artifact.description}</div>
      </div>
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
          messages.map((message) => (
            <div key={message.id} className={`chat-message ${message.role}`}>
              <div className="message-header">
                <div className="message-avatar">{message.role === "user" ? "You" : "AI"}</div>
                <div className="message-role">{message.role === "user" ? "You" : "Claude"}</div>
              </div>
              <div className="message-content">
                <ReactMarkdown>{message.content}</ReactMarkdown>
                {message.artifacts && message.artifacts.length > 0 && (
                  <div className="artifacts-container">
                    {message.artifacts.map((artifact) => renderArtifactCard(artifact))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="chat-input-container">
        <textarea
          className="chat-input"
          placeholder="Message Claude..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="send-button" onClick={sendMessage} disabled={!newMessage.trim()}>
          →
        </button>
      </div>
    </>
  );
};

export default ChatSidebar;
