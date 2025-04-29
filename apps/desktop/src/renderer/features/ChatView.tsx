import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import FactsSidebar from "../components/FactsSidebar";
import { Artifact, ChatMessage, ContextItem, StreamUpdate } from "../types";

// Add some CSS for streaming updates
const styles = {
  streamingUpdates: {
    padding: "12px 16px",
    background: "rgba(0, 0, 0, 0.05)",
    borderRadius: "6px",
    fontSize: "15px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  streamingUpdatesLabel: {
    fontWeight: "bold",
    fontSize: "13px",
    color: "#666",
  },
  streamingUpdatesValue: {
    fontWeight: "600",
    color: "#0066cc",
    fontSize: "16px",
  },
  highLevelToolCall: {
    marginBottom: "12px",
  },
  highLevelToolHeader: {
    fontWeight: "600",
    color: "#0066cc",
    fontSize: "16px",
    marginBottom: "6px",
  },
  intermediateToolCalls: {
    marginLeft: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  intermediateToolCall: {
    padding: "6px 10px",
    background: "rgba(0, 0, 0, 0.03)",
    borderRadius: "4px",
    fontSize: "14px",
    color: "#444",
  },
  responseStream: {
    marginTop: "12px",
    padding: "12px",
    borderRadius: "6px",
    fontSize: "14px",
    whiteSpace: "pre-wrap" as const,
    maxHeight: "300px",
    overflow: "auto",
  },
};

interface ChatViewProps {
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

const ChatView: React.FC<ChatViewProps> = ({
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hoveredContextId, setHoveredContextId] = useState<string | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localMode, setLocalMode] = useState<"agent" | "manual">(chatMode);

  // Get the latest assistant message with postprocessing data
  const latestMessageWithPostprocessing = messages
    .filter((m) => m.role === "assistant" && (m.logPostprocessing || m.codePostprocessing))
    .pop();

  // Determine if we should show the facts sidebar
  const shouldShowFactsSidebar =
    !!latestMessageWithPostprocessing &&
    latestMessageWithPostprocessing.content !== "Thinking..." &&
    ((latestMessageWithPostprocessing.logPostprocessing?.facts.length || 0) > 0 ||
      (latestMessageWithPostprocessing.codePostprocessing?.facts.length || 0) > 0);

  useEffect(() => {
    setLocalMode(chatMode);
  }, [chatMode]);

  // Function to resize textarea based on content
  const resizeTextarea = () => {
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
  };

  // Auto-resize textarea when message changes
  useEffect(() => {
    resizeTextarea();
  }, [newMessage]);

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
  }, []);

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

  // Wrapper for sendMessage to ensure textarea is reset
  const handleSendMessage = async () => {
    await sendMessage();

    // Force reset textarea height after sending
    if (textareaRef.current) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "28px";
        }
      }, 50);
    }

    // Ensure context items are cleared even if there's an issue with the hook's clearing
    if (contextItems.length > 0 && removeContextItem) {
      // Create a copy to avoid modification during iteration
      const itemsToRemove = [...contextItems];
      itemsToRemove.forEach((item) => removeContextItem(item.id));
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

  const _renderArtifactCard = (artifact: Artifact): JSX.Element => {
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

  // Function to render stream updates
  const renderStreamUpdates = (updates: StreamUpdate[]) => {
    if (!updates || updates.length === 0) return null;

    // Combine all response content
    const responseContent = updates
      .filter((update) => update.type === "response")
      .map((update) => (update as { type: "response"; content: string }).content)
      .join("");

    return (
      <div style={styles.streamingUpdates}>
        {/* Render high-level tool calls */}
        {updates
          .filter((update) => update.type === "highLevelToolCall")
          .map((update, index) => {
            const highLevelUpdate = update as {
              type: "highLevelToolCall";
              id: string;
              tool: string;
              children?: StreamUpdate[];
            };
            return (
              <div key={`high-${index}`} style={styles.highLevelToolCall}>
                <div style={styles.highLevelToolHeader}>{highLevelUpdate.tool}</div>

                {/* Render intermediate tool calls under this high-level tool */}
                {highLevelUpdate.children && highLevelUpdate.children.length > 0 && (
                  <div style={styles.intermediateToolCalls}>
                    {highLevelUpdate.children.map((child, childIndex) => {
                      if (child.type === "intermediateToolCall") {
                        let details = "";
                        if (child.details) {
                          if (typeof child.details === "object") {
                            details = Object.entries(child.details)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(", ");
                          } else {
                            details = String(child.details);
                          }
                        }
                        return (
                          <div key={`inter-${childIndex}`} style={styles.intermediateToolCall}>
                            {child.tool} {details ? `(${details})` : ""}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            );
          })}

        {/* Render standalone intermediate tool calls (those without a parent) */}
        {updates
          .filter(
            (update) =>
              update.type === "intermediateToolCall" &&
              !updates.some(
                (u) =>
                  u.type === "highLevelToolCall" &&
                  u.id === (update as { parentId: string }).parentId
              )
          )
          .map((update, index) => {
            const intermediateUpdate = update as {
              type: "intermediateToolCall";
              parentId: string;
              tool: string;
              details?: Record<string, any>;
            };
            let details = "";
            if (intermediateUpdate.details) {
              if (typeof intermediateUpdate.details === "object") {
                details = Object.entries(intermediateUpdate.details)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(", ");
              } else {
                details = String(intermediateUpdate.details);
              }
            }
            return (
              <div key={`standalone-${index}`} style={styles.intermediateToolCall}>
                {intermediateUpdate.tool} {details ? `(${details})` : ""}
              </div>
            );
          })}

        {/* Render response content if present */}
        {responseContent && (
          <div style={styles.responseStream}>
            <ReactMarkdown>{responseContent}</ReactMarkdown>
          </div>
        )}
      </div>
    );
  };

  // Function to render message content with animated ellipsis for "Thinking..."
  const renderMessageContent = (message: ChatMessage) => {
    // First check if there are context items
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

        {message.content === "Thinking..." ? (
          <div className="thinking-message">
            {message.streamingUpdates && message.streamingUpdates.length > 0 ? (
              renderStreamUpdates(message.streamingUpdates)
            ) : (
              <span className="thinking-text">Processing...</span>
            )}
          </div>
        ) : (
          <div className={`message-text ${hasContextItems ? "message-text-with-context" : ""}`}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="chat-tab">
      <div className={`chat-container ${shouldShowFactsSidebar ? "with-facts-sidebar" : ""}`}>
        <div className="chat-messages-container">
          <div className="chat-messages">
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
                    key={message.id}
                    className={`chat-message ${message.role} ${
                      message.content === "Thinking..." ? "thinking-state" : ""
                    } ${
                      index > 0 && messages[index - 1].role !== message.role ? "role-change" : ""
                    }`}
                  >
                    <div className="message-content">{renderMessageContent(message)}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {shouldShowFactsSidebar && latestMessageWithPostprocessing && (
          <FactsSidebar
            logFacts={latestMessageWithPostprocessing.logPostprocessing?.facts || []}
            codeFacts={latestMessageWithPostprocessing.codePostprocessing?.facts || []}
          />
        )}

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
              onClick={handleSendMessage}
              disabled={isThinking || !newMessage.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
