import { User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CellView from "../components/CellView.js";
import ChatInputArea from "../components/ChatInputArea.js";
import ContextItemView from "../components/ContextItemView.js";
import FactsSidebar from "../components/FactsSidebar.js";
import { Markdown } from "../components/ui/Markdown.jsx";
import { ScrollArea } from "../components/ui/ScrollArea.jsx";
import { cn } from "../lib/utils.js";
import { useChatStore, useUIStore } from "../store/index.js";
import { AssistantMessage, CodePostprocessingFact, LogPostprocessingFact } from "../types/index.js";

function ChatView() {
  const messages = useChatStore((state) =>
    state.currentChatId !== undefined
      ? state.chatDetailsById[state.currentChatId]?.messages
      : undefined
  );
  const isThinking = useChatStore((state) =>
    state.currentChatId !== undefined
      ? state.chatDetailsById[state.currentChatId]?.isThinking
      : false
  );
  const showFactsSidebar = useUIStore.use.showFactsSidebar();
  const activeSidebarMessageId = useUIStore.use.activeSidebarMessageId();
  const showFactsForMessage = useUIStore.use.showFactsForMessage();

  // Facts sidebar state
  const [logFacts, setLogFacts] = useState<LogPostprocessingFact[]>([]);
  const [codeFacts, setCodeFacts] = useState<CodePostprocessingFact[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll only when the last message is from the user
  useEffect(() => {
    if (!messages) return;
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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
        <h1 className="text-lg font-semibold text-primary break-all">Chat</h1>
      </div>

      <div className="flex flex-1 relative min-h-0 overflow-hidden">
        {/* Main chat area with conditional right padding when sidebar is open */}
        <div
          className={cn(
            "transition-all duration-300 ease-in-out flex flex-col h-full w-full min-w-0",
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
            <div
              className="flex flex-col justify-start h-auto w-full min-w-0"
              style={{
                minWidth: "0 !important",
                display: "flex !important",
                width: "100%",
              }}
            >
              {messages?.map((message) =>
                message.role === "user" ? (
                  <div key={`user-${message.id}`} className="py-4 px-4 bg-background-assistant">
                    <div className="flex items-start w-full mx-auto px-4 sm:px-8 md:px-12">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center mr-3 flex-shrink-0 shadow-sm bg-primary my-3">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 overflow-hidden pt-0.5 min-w-0">
                        {/* Context Items Cards */}
                        {message.contextItems && message.contextItems.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {message.contextItems.map((item, index) => (
                              <ContextItemView key={index} item={item} index={index} />
                            ))}
                          </div>
                        )}
                        <div className="bg-background-alt p-4 rounded-lg shadow-sm w-full break-words break-all">
                          <Markdown>{message.content}</Markdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={`assistant-${message.id}`} className="bg-background-assistant">
                    <div className="w-full mx-auto px-4 sm:px-8 md:px-12">
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

          {/* Chat input area - moved inside the main container */}
          <ChatInputArea />
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
    </div>
  );
}

export default ChatView;
