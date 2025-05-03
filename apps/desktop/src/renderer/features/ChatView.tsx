import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import CellView from "../components/CellView";
import api from "../services/api";
import { AssistantMessage, ChatMessage, ContextItem, UserMessage } from "../types";

// Add this import for type checking
declare global {
  interface Window {
    electronAPI: {
      saveUserMessage: (message: UserMessage) => Promise<number | null>;
      saveAssistantMessage: (message: AssistantMessage) => Promise<number | null>;
      loadChatMessages: () => Promise<ChatMessage[]>;
      clearChat: () => Promise<boolean>;
      // other API methods...
      [key: string]: any;
    };
  }
}

// Generate a unique ID for new messages
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

interface ChatViewProps {
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  newMessage: string;
  setNewMessage: (message: string) => void;
  sendMessage: () => Promise<void>;
  isThinking: boolean;
  contextItems?: ContextItem[];
  removeContextItem?: (id: string) => void;
  initialChatMode?: "agent" | "manual";
  toggleChatMode?: () => void;
  clearChat?: () => Promise<void>;
}

const ChatView: React.FC<ChatViewProps> = ({
  messages,
  setMessages,
  newMessage,
  setNewMessage,
  sendMessage,
  isThinking,
  contextItems = [],
  removeContextItem,
  initialChatMode = "agent",
  toggleChatMode,
  clearChat,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hoveredContextId, setHoveredContextId] = useState<string | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [chatMode, setChatMode] = useState<"agent" | "manual">(initialChatMode);

  // Load saved messages when component mounts
  useEffect(() => {
    const loadSavedMessages = async () => {
      try {
        const savedMessages = await api.loadChatMessages();
        if (savedMessages && savedMessages.length > 0) {
          setMessages(savedMessages);
        }
      } catch (error) {
        console.error("Error loading saved messages:", error);
      }
    };

    loadSavedMessages();
  }, [setMessages]);

  // Function to resize textarea based on content
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to default
    textarea.style.height = "28px";

    // Adjust height based on content
    const scrollHeight = textarea.scrollHeight;
    if (scrollHeight > 28) {
      const newHeight = Math.min(150, scrollHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // Auto-resize textarea when message changes
  useEffect(() => {
    resizeTextarea();
  }, [newMessage, resizeTextarea]);

  // Update local mode when chatMode prop changes
  useEffect(() => {
    setChatMode(chatMode);
  }, [chatMode]);

  // Auto-focus the textarea when the chat view is selected or when thinking state changes
  useEffect(() => {
    // Small delay to ensure the DOM is fully rendered
    const focusTimeout = setTimeout(() => {
      if (textareaRef.current && !isThinking) {
        textareaRef.current.focus();
      }
    }, 10);

    return () => clearTimeout(focusTimeout);
  }, [isThinking]);

  // Auto-focus on component mount
  useEffect(() => {
    if (textareaRef.current && !isThinking) {
      textareaRef.current.focus();
    }
  }, [isThinking]);

  // Add event listeners for textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Handle paste events specifically
    const handlePaste = () => {
      // Use setTimeout to ensure we resize after paste content is added
      setTimeout(resizeTextarea, 0);
    };

    // Handle input events (typing, deleting)
    const handleInput = () => {
      resizeTextarea();
    };

    // Add event listeners
    textarea.addEventListener("paste", handlePaste);
    textarea.addEventListener("input", handleInput);

    // Cleanup
    return () => {
      textarea.removeEventListener("paste", handlePaste);
      textarea.removeEventListener("input", handleInput);
    };
  }, [resizeTextarea]);

  // Force reset textarea height when empty
  useEffect(() => {
    if (newMessage === "" && textareaRef.current) {
      textareaRef.current.style.height = "28px";
    }
  }, [newMessage]);

  // Force reset textarea height after sending a message
  useEffect(() => {
    if (isThinking && textareaRef.current) {
      // If we're now thinking, a message was just sent
      textareaRef.current.style.height = "28px";
    }
  }, [isThinking]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (newMessage.trim()) {
        handleSendMessage();
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
    setChatMode(mode);

    // Only trigger change if needed and handler exists
    if (chatMode !== mode && toggleChatMode) {
      // Call the actual toggle function to update parent state
      toggleChatMode();
    }

    setModeMenuOpen(false);
  };

  // Use the provided clearChat function if available, otherwise fallback
  const handleClearChat = async () => {
    if (clearChat) {
      await clearChat();
    } else {
      console.error("clearChat function not provided to ChatView component");
    }
  };

  // Enhanced send message function to save messages
  const handleSendMessage = async () => {
    // Create a new user message
    const userMessage: UserMessage = {
      id: generateId(),
      role: "user",
      timestamp: new Date(),
      content: newMessage,
      contextItems: contextItems.length > 0 ? [...contextItems] : undefined,
    };

    // Add to UI state
    setMessages([...messages, userMessage]);

    // Save to database
    await api.saveUserMessage(userMessage);

    // Clear input
    setNewMessage("");

    // Call the original send function to generate response
    await sendMessage();

    // Force reset textarea height after sending
    if (textareaRef.current) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "28px";
        }
      }, 50);
    }

    // Ensure context items are cleared
    if (contextItems.length > 0 && removeContextItem) {
      const itemsToRemove = [...contextItems];
      itemsToRemove.forEach((item) => removeContextItem(item.id));
    }
  };

  // Watch for new assistant messages and save them
  useEffect(() => {
    // Look for the most recent assistant message that might need saving
    const assistantMessages = messages.filter(
      (msg) => msg.role === "assistant"
    ) as AssistantMessage[];

    if (assistantMessages.length > 0) {
      const latestMessage = assistantMessages[assistantMessages.length - 1];

      // Don't save "Thinking..." messages
      if (latestMessage.response !== "Thinking...") {
        // Save to database
        api
          .saveAssistantMessage(latestMessage)
          .catch((err: Error) => console.error("Error saving assistant message:", err));
      }
    }
  }, [messages]);

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      return "Invalid time range";
    }
  };

  // Render a context item card, with optional removal button
  const renderContextCard = (
    contextItem: ContextItem,
    showRemoveButton: boolean = true
  ): JSX.Element => {
    // Handle different context item types
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
          {showRemoveButton && hoveredContextId === contextItem.id && removeContextItem && (
            <button
              className="remove-context-button"
              onClick={(e) => {
                e.stopPropagation();
                removeContextItem(contextItem.id);
              }}
              title="Remove from context"
            >
              ×
            </button>
          )}
        </div>
      );
    } else if (contextItem.type === "singleTrace") {
      // Handle single trace context item
      const traceData = contextItem.data;

      return (
        <div
          key={contextItem.id}
          className="context-card"
          onMouseEnter={() => setHoveredContextId(contextItem.id)}
          onMouseLeave={() => setHoveredContextId(null)}
        >
          <div className="context-card-content">
            <div className="context-type">trace</div>
            <div className="context-title" title={contextItem.title}>
              {contextItem.title}
            </div>
            <div className="context-trace-id" title={traceData.traceId}>
              ID: {traceData.traceId.substring(0, 8)}...
            </div>
            {traceData.startTime && traceData.endTime && (
              <div className="context-time-range">
                {formatTimeRange(
                  traceData.startTime instanceof Date
                    ? traceData.startTime.toISOString()
                    : String(traceData.startTime),
                  traceData.endTime instanceof Date
                    ? traceData.endTime.toISOString()
                    : String(traceData.endTime)
                )}
              </div>
            )}
          </div>
          {showRemoveButton && hoveredContextId === contextItem.id && removeContextItem && (
            <button
              className="remove-context-button"
              onClick={(e) => {
                e.stopPropagation();
                removeContextItem(contextItem.id);
              }}
              title="Remove from context"
            >
              ×
            </button>
          )}
        </div>
      );
    }

    // Fallback for unknown context item types
    const unknownContextItem = contextItem as ContextItem;
    return (
      <div
        key={unknownContextItem.id}
        className="context-card"
        onMouseEnter={() => setHoveredContextId(unknownContextItem.id)}
        onMouseLeave={() => setHoveredContextId(null)}
      >
        <div className="context-card-content">
          <div className="context-type">{unknownContextItem.type}</div>
          <div className="context-title">{unknownContextItem.title}</div>
          <div className="context-description">{unknownContextItem.description}</div>
        </div>
        {showRemoveButton && hoveredContextId === unknownContextItem.id && removeContextItem && (
          <button
            className="remove-context-button"
            onClick={(e) => {
              e.stopPropagation();
              removeContextItem(unknownContextItem.id);
            }}
            title="Remove from context"
          >
            ×
          </button>
        )}
      </div>
    );
  };

  // Function to render message content
  const renderMessageContent = (message: ChatMessage) => {
    if (message.role === "user") {
      // Handle user message
      const hasContextItems = message.contextItems && message.contextItems.length > 0;

      return (
        <>
          {hasContextItems && message.contextItems && (
            <div className="message-context-items">
              <div className="context-items-header">
                <span>Attached Context</span>
              </div>
              <div className="context-items-attached">
                {message.contextItems.map((item) => renderContextCard(item, false))}
              </div>
            </div>
          )}

          <div className={`message-text ${hasContextItems ? "message-text-with-context" : ""}`}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </>
      );
    } else {
      // Handle assistant message - use direct CellView for streaming
      const asst = message as AssistantMessage;
      if (isThinking && asst.response === "Thinking...") {
        // For thinking assistant message, render the CellView without wrapper
        return <CellView message={asst} isThinking />;
      }
      // For completed assistant message
      return <CellView message={asst} isThinking={false} />;
    }
  };

  return (
    <div className="chat-tab" style={{ overflow: "hidden", width: "100%", height: "100%" }}>
      <div
        className="chat-container"
        style={{
          width: "100%",
          maxWidth: "100%",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* Add Clear Chat Button */}
        <div
          className="chat-controls"
          style={{ padding: "8px", display: "flex", justifyContent: "flex-end" }}
        >
          <button
            onClick={handleClearChat}
            className="clear-chat-button"
            style={{
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              padding: "6px 12px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Clear Chat
          </button>
        </div>

        <div
          className="chat-messages-container"
          style={{
            width: "100%",
            maxWidth: "100%",
            flex: "1 1 auto",
            overflow: "auto",
          }}
        >
          <div
            className="chat-messages"
            style={{ width: "100%", maxWidth: "100%", padding: "0 8px" }}
          >
            {messages.length === 0 ? (
              <div className="empty-chat">
                <div className="welcome-message">
                  <h2>Chat with Triage Assistant</h2>
                  <p>Ask questions about your logs, traces, or codebase.</p>
                  <p>Use ⌘+U in other views to add context from those views.</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`chat-message ${message.role} ${message.role === "assistant" && (message as AssistantMessage).response === "Thinking..." ? "thinking-state" : ""}`}
                    style={{
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      overflow: "hidden",
                      marginBottom: "16px",
                    }}
                  >
                    <div className="message-content" style={{ width: "100%", maxWidth: "100%" }}>
                      {renderMessageContent(message)}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="chat-input-container">
        {contextItems.length > 0 && (
          <div className="context-items-container">
            <div className="context-items-header">
              <span>Current Context</span>
              <span className="context-keyboard-shortcut">Add more with ⌘+U in other views</span>
            </div>
            <div className="context-items-list">
              {contextItems.map((item) => renderContextCard(item, true))}
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
            autoFocus={!isThinking}
          />
        </div>

        <div className="message-controls">
          <div className="mode-dropdown">
            <button className="mode-selector-button" onClick={toggleModeMenu}>
              <span className="current-mode">{chatMode === "agent" ? "Agent" : "Manual"}</span>
              <span className="dropdown-arrow">▼</span>
            </button>

            {modeMenuOpen && (
              <div className="mode-menu">
                <div
                  className={`mode-option ${chatMode === "agent" ? "active" : ""}`}
                  onClick={() => setMode("agent")}
                >
                  Agent
                </div>
                <div
                  className={`mode-option ${chatMode === "manual" ? "active" : ""}`}
                  onClick={() => setMode("manual")}
                >
                  Manual
                </div>
              </div>
            )}
          </div>

          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={isThinking || !newMessage.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
