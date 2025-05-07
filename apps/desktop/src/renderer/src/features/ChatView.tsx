import { useEffect, useRef } from "react";
import CellView from "../components/CellView";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { ScrollArea } from "../components/ui/scroll-area";
import { useChat } from "../hooks/useChat";
import { MoreHorizontalIcon, SendIcon } from "../icons";
import { cn } from "../lib/utils";
import { AssistantMessage } from "../types";

function ChatView() {
  const {
    messages,
    newMessage,
    setNewMessage,
    sendMessage,
    isThinking,
    contextItems,
    removeContextItem,
    chatMode,
    toggleChatMode,
    clearChat,
  } = useChat();

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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

    // Call the send function from the hook
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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat header */}
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h1 className="text-xl font-semibold text-primary">Chat</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontalIcon className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleClearChat}>Clear chat</DropdownMenuItem>
            <DropdownMenuItem onClick={() => console.info("Export chat")}>
              Export chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chat messages */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="flex flex-col divide-y divide-border">
          {messages.map((message) => (
            <CellView
              key={message.id}
              role={message.role}
              content={
                message.role === "user" ? message.content : (message as AssistantMessage).response
              }
              steps={
                message.role === "assistant"
                  ? (message as AssistantMessage).stages?.map((stage) => ({
                      id: stage.id,
                      title: stage.type,
                      content: "content" in stage ? stage.content : JSON.stringify(stage),
                    })) || []
                  : []
              }
            />
          ))}
          {isThinking && (
            <div className="p-4 text-center text-gray-400">Assistant is thinking...</div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Context items display */}
      {contextItems && contextItems.length > 0 && (
        <div className="p-2 border-t border-border bg-background-lighter">
          <div className="flex flex-wrap gap-2">
            {contextItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center bg-background-alt rounded-md p-1.5 text-sm gap-1.5"
              >
                <span className="text-xs font-medium">{item.type}</span>
                <span>{item.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 ml-1"
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
      <div className="p-4 border-t border-border">
        <div className="relative">
          <textarea
            ref={textareaRef}
            className={cn(
              "w-full p-3 pr-12 bg-background-lighter border border-border rounded-md",
              "resize-none min-h-[80px] max-h-[200px] outline-none focus:ring-2 focus:ring-primary/50",
              "text-primary placeholder:text-gray-500"
            )}
            placeholder="Type your message here..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            disabled={isThinking}
          />
          <Button
            className="absolute right-2 bottom-2"
            size="sm"
            onClick={handleSendMessage}
            disabled={newMessage.trim() === "" || isThinking}
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 text-xs text-gray-500 text-right">
          Press Enter to send, Shift+Enter for new line
        </div>

        {/* Chat mode selection */}
        <div className="mt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={toggleChatMode} className="text-xs">
            Mode: {chatMode === "agent" ? "AI Agent" : "Manual"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ChatView;
