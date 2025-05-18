import { X } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";
import { SendIcon } from "../icons/index.jsx";
import { cn } from "../lib/utils.js";
import { useChatStore } from "../store/index.js";
import {
  datadogLogsViewUrlToLogSearchInput,
  isValidDatadogLogsViewUrl,
} from "../utils/facts/logs.js";
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
  const contextItems = useChatStore((state) =>
    state.currentChatId !== undefined
      ? state.chatDetailsById[state.currentChatId]?.contextItems
      : undefined
  );

  // Default context items to empty array locally to avoid new array each render
  const effectiveContextItems = contextItems ?? [];

  const setUserInput = useChatStore.use.setUserInput();
  const setContextItems = useChatStore.use.setContextItems();
  const sendMessage = useChatStore.use.sendMessage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [currentChatId]);

  // Auto-resize textarea function
  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to default
    textarea.style.height = "50px";

    // Adjust height based on content
    const scrollHeight = textarea.scrollHeight;
    if (scrollHeight > 50) {
      const newHeight = Math.min(150, scrollHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  // Auto-resize textarea when message changes
  useEffect(() => {
    resizeTextarea();
  }, [userInput]);

  // Focus input on mount and when thinking state changes
  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      if (textareaRef.current && !isThinking) {
        textareaRef.current.focus();
      }
    }, 10);

    return () => clearTimeout(focusTimeout);
  }, [isThinking]);

  // Function to extract Datadog URL from text - memoized to prevent infinite re-renders
  const tryExtractDatadogLogsViewUrl = useCallback(
    (text: string) => {
      if (!text || !isValidDatadogLogsViewUrl(text)) {
        return false;
      }

      try {
        const logSearchInput = datadogLogsViewUrlToLogSearchInput(text);
        let added = false;
        setContextItems((currentItems) => {
          const exists = currentItems.some(
            (item) =>
              item.type === "logSearchInput" &&
              item.query === logSearchInput.query &&
              item.start === logSearchInput.start &&
              item.end === logSearchInput.end
          );
          if (!exists) {
            added = true;
            return [...currentItems, logSearchInput];
          }
          return currentItems;
        });
        return added;
      } catch (error) {
        console.error("Error converting Datadog URL:", error);
        return false;
      }
    },
    [setContextItems]
  );

  // Add event listeners for textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Handle paste events
    const handlePaste = (e: ClipboardEvent) => {
      // Allow default paste to insert content, then react
      const pastedText = e.clipboardData?.getData("text") || "";
      if (pastedText && tryExtractDatadogLogsViewUrl(pastedText)) {
        // Prevent URL text from being inserted
        e.preventDefault();
        return;
      }
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
  }, [tryExtractDatadogLogsViewUrl]);

  // Reset textarea height when empty
  useEffect(() => {
    if (userInput === "" && textareaRef.current) {
      textareaRef.current.style.height = "50px";
    }
  }, [userInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (userInput.trim() || effectiveContextItems.length > 0) {
        handleSendMessage();
      }
    }
  };

  // Function to remove a context item
  const removeContextItem = (index: number) => {
    setContextItems((prevContextItems) => prevContextItems.filter((_, i) => i !== index));
  };

  // Format date range for display
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Format time as HH:MM
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    return `${formatTime(startDate)} - ${formatTime(endDate)}`;
  };

  // Send message function
  const handleSendMessage = async () => {
    if ((!userInput.trim() && effectiveContextItems.length === 0) || isThinking) return;

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
        {effectiveContextItems.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {effectiveContextItems.map((item, index) => (
              <div
                key={index}
                className="bg-background-alt border border-border rounded-md px-2 py-1 text-xs flex items-center gap-1.5"
              >
                <span className="font-medium text-gray-300 truncate max-w-[200px]">
                  {item.type === "logSearchInput"
                    ? (item as any).query || "Datadog Search"
                    : "Context Item"}
                </span>
                {item.type === "logSearchInput" && (
                  <span className="text-gray-400">
                    {formatDateRange((item as any).start, (item as any).end)}
                  </span>
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

        <textarea
          ref={textareaRef}
          className={cn(
            "w-full p-3 pr-10 bg-background border border-border rounded-lg",
            "resize-none min-h-[50px] max-h-[200px] outline-none focus-ring",
            "placeholder:text-gray-500 text-sm shadow-sm",
            "align-middle leading-normal pt-[13px] overflow-y-hidden"
          )}
          placeholder="Type your message here..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isThinking}
        />
        <Button
          className="absolute right-2 bottom-2 shadow-sm size-8 p-1"
          size="sm"
          onClick={handleSendMessage}
          disabled={(userInput.trim() === "" && effectiveContextItems.length === 0) || isThinking}
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
