import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import CellView from "../components/CellView.js";
import FactsSidebar from "../components/FactsSidebar.js";
import { Button } from "../components/ui/button.jsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenu.jsx";
import { ScrollArea } from "../components/ui/ScrollArea.jsx";
import { MoreHorizontalIcon, SendIcon } from "../icons/index.jsx";
import { cn } from "../lib/utils.js";
import { AssistantMessage, CodePostprocessingFact, LogPostprocessingFact } from "../types/index.js";

// Import stores and hooks
import { useChatStore, useUIStore } from "../store/index.js";

function ChatView() {
  // Get chat state from store
  const {
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    isThinking,
    contextItems,
    removeContextItem,
    clearChat,
  } = useChatStore();

  // Get UI state from store
  const { showFactsSidebar, activeSidebarMessageId, showFactsForMessage } = useUIStore();

  // Facts sidebar state
  const [logFacts, setLogFacts] = useState<LogPostprocessingFact[]>([]);
  const [codeFacts, setCodeFacts] = useState<CodePostprocessingFact[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea function
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

  // Scroll behavior for messages
  useEffect(() => {
    // Auto-scroll only when the last message is from the user
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Focus input on mount and when thinking state changes
  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      if (textareaRef.current && !isThinking) {
        textareaRef.current.focus();
      }
    }, 10);

    return () => clearTimeout(focusTimeout);
  }, [isThinking]);

  // Add event listeners for textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Handle paste events
    const handlePaste = () => {
      setTimeout(resizeTextarea, 0);
    };

    // Handle input events
    const handleInput = () => {
      resizeTextarea();
    };

    textarea.addEventListener("paste", handlePaste);
    textarea.addEventListener("input", handleInput);

    return () => {
      textarea.removeEventListener("paste", handlePaste);
      textarea.removeEventListener("input", handleInput);
    };
  }, []);

  // Reset textarea height when empty
  useEffect(() => {
    if (newMessage === "" && textareaRef.current) {
      textareaRef.current.style.height = "28px";
    }
  }, [newMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim()) {
        handleSendMessage();
      }
    }
  };

  // Send message function
  const handleSendMessage = async () => {
    if (!newMessage.trim() || isThinking) return;

    // Call the send function from the store
    await sendMessage();

    // Reset textarea height after sending
    if (textareaRef.current) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "28px";
        }
      }, 50);
    }
  };

  const handleClearChat = async () => {
    if (clearChat) {
      await clearChat();
    }
  };

  // Function to open facts sidebar for a specific message
  const openFactsSidebar = (
    messageId: string,
    logFacts: LogPostprocessingFact[],
    codeFacts: CodePostprocessingFact[]
  ) => {
    setLogFacts(logFacts);
    setCodeFacts(codeFacts);
    showFactsForMessage(messageId);
  };

  // Function to close facts sidebar
  const closeFactsSidebar = () => {
    showFactsForMessage(null);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Chat header */}
      <div className="flex justify-between items-center py-3 px-4 border-b border-border bg-background-lighter backdrop-blur-sm shadow-sm z-10">
        <h1 className="text-lg font-semibold text-primary">Chat</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="hover:bg-background-alt h-8 w-8 p-0">
              <MoreHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[150px]">
            <DropdownMenuItem onClick={handleClearChat} className="cursor-pointer">
              Clear chat
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => console.info("Export chat")}
              className="cursor-pointer"
            >
              Export chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 relative min-h-0 overflow-hidden">
        {/* Main chat area with conditional right padding when sidebar is open */}
        <div
          className={cn(
            "transition-all duration-300 ease-in-out flex flex-col h-full w-full",
            showFactsSidebar && "md:pr-[calc(33%+24px)]",
            "bg-background-assistant"
          )}
        >
          {/* Chat messages */}
          <ScrollArea
            className="flex-1 overflow-y-auto overflow-x-hidden scroll-container"
            type="always"
            scrollHideDelay={0}
          >
            <div className="flex flex-col justify-start h-auto w-full">
              {/* No spacer needed anymore - messages should start at the top */}
              {messages.map((message) =>
                message.role === "user" ? (
                  <div
                    key={`user-${message.id}`}
                    className={cn("py-4 px-4 flex flex-col bg-background-assistant")}
                  >
                    <div className="flex items-start max-w-[90%] mx-auto w-full mt-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 flex-shrink-0 shadow-sm bg-primary my-2">
                        <span className="text-white font-medium text-sm">U</span>
                      </div>
                      <div className="flex-1 overflow-hidden pt-0.5 min-w-0 max-w-full">
                        <div className="prose prose-invert max-w-none prose-p:my-3 prose-headings:mt-6 prose-headings:mb-3 break-words bg-background-alt p-3 rounded-lg shadow-sm overflow-x-auto overflow-wrap-anywhere min-w-0">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={`assistant-${message.id}`} className="bg-background-assistant">
                    <div className="max-w-[90%] mx-auto w-full">
                      <CellView
                        message={message as AssistantMessage}
                        isThinking={
                          isThinking && (message as AssistantMessage).response === "Thinking..."
                        }
                        onShowFacts={(logFactsArr, codeFactsArr) =>
                          openFactsSidebar(message.id, logFactsArr, codeFactsArr)
                        }
                        activeInFactsSidebar={
                          showFactsSidebar && activeSidebarMessageId === message.id
                        }
                      />
                    </div>
                  </div>
                )
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </ScrollArea>
        </div>

        {/* Facts sidebar - fixed position with transform-based animation */}
        <div
          className={cn(
            "fixed top-0 right-0 h-full w-full md:w-[33%] bg-background-sidebar border-l border-border shadow-md transition-transform duration-300 ease-in-out overflow-hidden pl-6 z-10",
            showFactsSidebar ? "translate-x-0" : "translate-x-full"
          )}
        >
          <FactsSidebar logFacts={logFacts} codeFacts={codeFacts} onClose={closeFactsSidebar} />
        </div>
      </div>

      {/* Context items display */}
      {contextItems && contextItems.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-background-lighter">
          <div className="flex flex-wrap gap-2 max-w-[75%] mx-auto">
            {contextItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center bg-background-alt rounded-lg px-2 py-1 text-xs gap-2 shadow-sm"
              >
                <span className="text-xs font-medium text-primary-dark">{item.type}</span>
                <span className="text-gray-300 truncate max-w-[160px]">{item.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-background-lighter text-gray-400 hover:text-white"
                  onClick={() => removeContextItem(item.id)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-border bg-background-lighter">
        <div className="relative max-w-[90%] mx-auto">
          <textarea
            ref={textareaRef}
            className={cn(
              "w-full p-3 pr-10 bg-background border border-border rounded-lg",
              "resize-none min-h-[50px] max-h-[200px] outline-none focus-ring",
              "text-primary-light placeholder:text-gray-500 text-sm shadow-sm"
            )}
            placeholder="Type your message here..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isThinking}
          />
          <Button
            className="absolute right-2 bottom-4 shadow-sm size-8 p-1"
            size="sm"
            onClick={handleSendMessage}
            disabled={newMessage.trim() === "" || isThinking}
          >
            <SendIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="mt-1.5 text-xs text-gray-500 text-left max-w-[90%] mx-auto">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

export default ChatView;
