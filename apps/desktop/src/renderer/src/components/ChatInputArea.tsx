import React, { useEffect, useRef } from "react";
import { SendIcon } from "../icons/index.jsx";
import { cn } from "../lib/utils.js";
import { useChatStore } from "../store/index.js";
import { Button } from "./ui/Button.jsx";

interface ChatInputAreaProps {
  isThinking: boolean;
}

function ChatInputArea({ isThinking }: ChatInputAreaProps) {
  const userInput = useChatStore.use.userInput();
  const setUserInput = useChatStore.use.setUserInput();
  const sendMessage = useChatStore.use.sendMessage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (userInput === "" && textareaRef.current) {
      textareaRef.current.style.height = "50px";
    }
  }, [userInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (userInput.trim()) {
        handleSendMessage();
      }
    }
  };

  // Send message function
  const handleSendMessage = async () => {
    if (!userInput.trim() || isThinking) return;

    // Call the send function from the store
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
          className="absolute right-2 top-2 shadow-sm size-8 p-1"
          size="sm"
          onClick={handleSendMessage}
          disabled={userInput.trim() === "" || isThinking}
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
