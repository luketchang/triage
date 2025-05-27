import { User } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  AssistantMessage,
  ChatMessage,
  CodePostprocessingFact,
  LogPostprocessingFact,
} from "../types/index.js";
import CellView from "./CellView.js";
import ContextItemView from "./ContextItemView.js";
import { ScrollArea } from "./ui/ScrollArea.jsx";

interface MessagesViewProps {
  messages?: ChatMessage[];
  isThinking: boolean;
  showFactsSidebar: boolean;
  activeSidebarMessageId: string | null;
  onShowFacts: (
    messageId: string,
    logFacts: LogPostprocessingFact[],
    codeFacts: CodePostprocessingFact[]
  ) => void;
}

function MessagesView({
  messages,
  isThinking,
  showFactsSidebar,
  activeSidebarMessageId,
  onShowFacts,
}: MessagesViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll only when the last message is from the user
  useEffect(() => {
    if (!messages) return;
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <ScrollArea className="h-full w-full" type="always" scrollHideDelay={0}>
      <div className="flex flex-col justify-start min-h-full w-full">
        {messages?.map((message) =>
          message.role === "user" ? (
            <div key={`user-${message.id}`} className="py-4 px-2 bg-background-assistant">
              <div className="flex items-start w-full mx-auto min-w-0 px-4 sm:px-8 md:px-12">
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
                  <div className="bg-background-alt p-2 rounded-lg shadow-sm overflow-hidden break-words w-full">
                    {/* <Markdown>{message.content}</Markdown> */}
                    {message.content}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div key={`assistant-${message.id}`} className="bg-background-assistant">
              <div className="w-full mx-auto min-w-0 px-4 sm:px-8 md:px-12">
                <CellView
                  message={message}
                  isThinking={
                    isThinking && (message as AssistantMessage).response === "Thinking..."
                  }
                  onShowFacts={(logFactsArr, codeFactsArr) =>
                    onShowFacts(message.id, logFactsArr, codeFactsArr)
                  }
                  activeInFactsSidebar={showFactsSidebar && activeSidebarMessageId === message.id}
                />
              </div>
            </div>
          )
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>
    </ScrollArea>
  );
}

export default MessagesView;
