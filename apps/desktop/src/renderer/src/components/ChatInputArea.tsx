import { ContextItem } from "@renderer/types/index.js";
import { Send, Square } from "lucide-react";
import React, { useEffect, useMemo, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { cn } from "../lib/utils.js";
import { useChatStore } from "../store/index.js";
import { datadogLogsViewUrlToLogSearchInput } from "../utils/parse/logs.js";
import { parseSentryEventUrl } from "../utils/parse/sentry.js";
import ContextItemView from "./ContextItemView.js";
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
  const cancelStream = useChatStore((state) =>
    state.currentChatId !== undefined
      ? state.chatDetailsById[state.currentChatId]?.cancelStream
      : undefined
  );
  const contextItems =
    useChatStore((state) =>
      state.currentChatId !== undefined
        ? state.chatDetailsById[state.currentChatId]?.contextItems
        : [undefined]
    ) ?? [];
  const hasNoInput = useMemo(
    () => userInput.trim() === "" && contextItems.length === 0,
    [userInput.trim(), contextItems.length]
  );

  const setUserInput = useChatStore.use.setUserInput();
  const removeContextItem = useChatStore.use.removeContextItem();
  const sendMessage = useChatStore.use.sendMessage();
  const addContextItem = useChatStore.use.addContextItem();
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

  const tryAddContextFromUrl = <T extends (text: string) => ContextItem | undefined>(
    fn: T,
    text: string
  ): boolean => {
    const contextItem = fn(text);
    if (contextItem) {
      addContextItem(contextItem);
      return true;
    }
    return false;
  };

  // Handle paste event to detect Datadog and Sentry URLs
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text");

    const added =
      tryAddContextFromUrl(datadogLogsViewUrlToLogSearchInput, text) ||
      tryAddContextFromUrl(parseSentryEventUrl, text);

    if (added) {
      e.preventDefault();
    }
  };

  // Submit message when Enter is pressed
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!hasNoInput) {
        handleSendMessage();
      }
    }
  };

  const handleSendMessage = async () => {
    if (hasNoInput || isThinking) return;
    // Call the send function from the store
    // The sendMessage function in the store will use the context items
    await sendMessage();
  };

  const handleCancelMessage = () => cancelStream?.();

  return (
    <div className="p-4 border-t border-border bg-background-lighter">
      <div className="relative max-w-[90%] mx-auto">
        {/* Context Items Cards */}
        {contextItems.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {contextItems.map((item, index) => (
              <ContextItemView key={index} item={item} index={index} onRemove={removeContextItem} />
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
        {!isThinking ? (
          <Button
            className="absolute right-2 top-2 shadow-sm size-8 p-1"
            size="sm"
            onClick={handleSendMessage}
            disabled={hasNoInput}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            className="absolute right-2 top-2 shadow-sm size-8 p-1"
            size="sm"
            onClick={handleCancelMessage}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="mt-1.5 text-xs text-gray-500 text-left max-w-[90%] mx-auto">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}

export default ChatInputArea;
