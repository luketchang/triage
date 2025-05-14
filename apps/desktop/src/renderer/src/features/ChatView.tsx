import { useEffect, useRef, useState } from "react";
import CellView from "../components/CellView.js";
import ChatInputArea from "../components/ChatInputArea.js";
import FactsSidebar from "../components/FactsSidebar.js";
import { Button } from "../components/ui/Button.jsx";
import { Markdown } from "../components/ui/Markdown.js";
import { ScrollArea } from "../components/ui/ScrollArea.jsx";
import { cn } from "../lib/utils.js";
import { AssistantMessage, CodePostprocessingFact, LogPostprocessingFact } from "../types/index.js";

// Import stores and hooks
import { User } from "lucide-react";
import { useChatStore, useUIStore } from "../store/index.js";

function ChatView() {
  // Get chat state from store
  const { messages, isThinking, contextItems, removeContextItem, unregisterFromAgentUpdates } =
    useChatStore();

  // Get UI state from store
  const { showFactsSidebar, activeSidebarMessageId, showFactsForMessage } = useUIStore();

  // Facts sidebar state
  const [logFacts, setLogFacts] = useState<LogPostprocessingFact[]>([]);
  const [codeFacts, setCodeFacts] = useState<CodePostprocessingFact[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll behavior for messages
  useEffect(() => {
    // Auto-scroll only when the last message is from the user
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Cleanup agent update listeners when component unmounts
  useEffect(() => {
    return () => {
      // Ensure we don't have lingering agent update listeners
      unregisterFromAgentUpdates();
    };
  }, [unregisterFromAgentUpdates]);

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
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={`user-${message.id}`} className="py-4 px-4 bg-background-assistant">
                    <div className="flex items-start max-w-[90%] mx-auto w-full">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center mr-3 flex-shrink-0 shadow-sm bg-primary my-3">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 overflow-hidden pt-0.5 min-w-0">
                        <div className="bg-background-alt p-4 rounded-lg shadow-sm">
                          <Markdown>{message.content}</Markdown>
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
      <ChatInputArea isThinking={isThinking} />
    </div>
  );
}

export default ChatView;
