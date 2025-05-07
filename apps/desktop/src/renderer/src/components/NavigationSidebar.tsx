import { useState } from "react";
import { ChatIcon } from "../icons";
import { TabType } from "../types";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
// removed unused import

// Define a simple Chat type for chat history
interface Chat {
  id: string;
  title: string;
  timestamp: Date;
}

interface NavigationSidebarProps {
  activeTab: TabType;
  handleTabChange: (tab: TabType) => void;
  contextItemsCount: number;
}

function NavigationSidebar({
  activeTab,
  handleTabChange,
  contextItemsCount,
}: NavigationSidebarProps) {
  // TODO: Replace with actual chat history functionality
  const [chatHistory] = useState<Chat[]>([]);

  // Make sure to keep the chat tab active
  if (activeTab !== "chat") {
    handleTabChange("chat");
  }

  return (
    <div className="w-60 h-full bg-background-sidebar border-r border-border flex flex-col">
      <div className="p-4 flex flex-col gap-4">
        <div className="text-primary font-bold text-center text-lg">TRIAGE</div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => console.info("New chat")}
        >
          <span className="text-lg">+</span> New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {chatHistory.length > 0 ? (
            chatHistory.map((chat) => (
              <div
                key={chat.id}
                className="flex items-center p-2 rounded-md hover:bg-background-lighter cursor-pointer mb-1 text-gray-200 group"
                onClick={() => console.info(`Clicked chat: ${chat.id}`)}
              >
                <ChatIcon className="w-4 h-4 mr-2 text-gray-400 group-hover:text-white" />
                <div className="text-sm truncate">{chat.title}</div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 text-sm p-4">No chat history yet</div>
          )}
        </div>
      </ScrollArea>

      {contextItemsCount > 0 && (
        <div className="text-xs text-primary p-2 text-center">
          {contextItemsCount} context item{contextItemsCount !== 1 ? "s" : ""} active
        </div>
      )}

      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-sm text-gray-300"
          onClick={() => console.info("Settings")}
        >
          Settings
        </Button>
      </div>
    </div>
  );
}

export default NavigationSidebar;
