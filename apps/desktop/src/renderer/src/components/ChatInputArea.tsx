import { formatDateRange } from "@renderer/utils/formatters.js";
import { X } from "lucide-react";
import React, { useEffect, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { SendIcon } from "../icons/index.jsx";
import { cn } from "../lib/utils.js";
import { useChatStore } from "../store/index.js";
import { Button } from "./ui/Button.jsx";

function ChatInputArea() {
  const currentChatId = useChatStore((state) => state.currentChatId);
  const userInput = useChatStore((state) =>
    state.currentChatId !== undefined
      ? state.chatDetailsById[state.currentChatId]?.userInput || ""
      : ""
  );
  const isThinking = useChatStore((state) =>
    state.currentChatId !== undefined
      ? state.chatDetailsById[state.currentChatId]?.isThinking || false
      : false
  );
  const contextItems =
    useChatStore((state) =>
      state.currentChatId !== undefined
        ? state.chatDetailsById[state.currentChatId]?.contextItems
        : [undefined]
    ) ?? [];

  const setUserInput = useChatStore.use.setUserInput();
  const removeContextItem = useChatStore.use.removeContextItem();
  const sendMessage = useChatStore.use.sendMessage();
  const tryAddDatadogContextFromUrl = useChatStore.use.tryAddDatadogContextFromUrl();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [currentChatId]);

  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      if (textareaRef.current && !isThinking) {
        textareaRef.current.focus();
      }
    }, 10);

    return () => clearTimeout(focusTimeout);
  }, [isThinking]);

  // Handle paste event to detect Datadog URLs
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text");
    if (tryAddDatadogContextFromUrl(text)) {
      // Intercepted a valid URL - don't insert it
      e.preventDefault();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (userInput.trim() || contextItems.length > 0) {
        handleSendMessage();
      }
    }
  };

  // Send message function
  const handleSendMessage = async () => {
    if ((!userInput.trim() && contextItems.length === 0) || isThinking) return;

    // Call the send function from the store
    // The sendMessage function in the store will use the context items
    await sendMessage();

    // Reset textarea height after sending
    if (textareaRef.current) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "50px";
        }
      }, 50);
    }
  };

  return (
    <div className="p-4 border-t border-border bg-background-lighter">
      <div className="relative max-w-[90%] mx-auto">
        {/* Context Items Cards */}
        {contextItems.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {contextItems.map((item, index) => (
              <div
                key={index}
                className="bg-background-alt border border-border rounded-md px-2 py-1 text-xs flex items-center gap-1.5"
              >
                <span className="font-medium text-gray-300 truncate max-w-[200px]">
                  {item.type === "logSearchInput"
                    ? item.query || "Datadog Log Search"
                    : "Context Item"}
                </span>
                {item.type === "logSearchInput" && (
                  <span className="text-gray-400">{formatDateRange(item.start, item.end)}</span>
                )}
                <button
                  className="text-gray-400 hover:text-gray-200"
                  onClick={() => removeContextItem(index)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <TextareaAutosize
          ref={textareaRef}
          className={cn(
            "w-full p-3 pr-10 bg-background border border-border rounded-lg",
            "resize-none outline-none focus-ring",
            "placeholder:text-gray-500 text-sm shadow-sm",
            "align-middle leading-normal pt-[13px]"
          )}
          placeholder="Type your message here..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isThinking}
          minRows={1}
          maxRows={6}
        />
        <Button
          className="absolute right-2 bottom-2 shadow-sm size-8 p-1"
          size="sm"
          onClick={handleSendMessage}
          disabled={(userInput.trim() === "" && contextItems.length === 0) || isThinking}
        >
          <SendIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-1.5 text-xs text-gray-500 text-left max-w-[90%] mx-auto">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}

export default ChatInputArea;
