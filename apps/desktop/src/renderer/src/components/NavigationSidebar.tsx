import { useState } from "react";
import { ChatIcon, SettingsIcon } from "../icons/index.jsx";
import { TabType } from "../types/index.js";
import { Button } from "./ui/Button.js";
import { ScrollArea } from "./ui/ScrollArea.js";

import { useChat } from "@renderer/hooks/use-chat.js";
import { FaPlus } from "react-icons/fa";
// removed unused import

// Define a simple Chat type for chat history
interface Chat {
  id: string;
  title: string;
  timestamp: Date;
}

interface NavigationSidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

function NavigationSidebar({ activeTab, setActiveTab }: NavigationSidebarProps) {
  // TODO: Replace with actual chat history functionality
  const [chatHistory] = useState<Chat[]>([]);

  const chatState = useChat();
  const contextItemsCount = chatState.contextItems.length;

  return (
    <div className="w-60 h-full bg-background-sidebar border-r border-border flex flex-col">
      <div className="p-4 flex flex-col gap-4">
        <div className="text-primary font-bold text-center text-lg">TRIAGE</div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => {
            setActiveTab("chat");
            console.info("New chat");
          }}
        >
          <FaPlus size={12} /> New Chat
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
          className={`w-full justify-start text-sm ${activeTab === "settings" ? "text-primary" : "text-gray-300"}`}
          onClick={() => setActiveTab("settings")}
        >
          <SettingsIcon className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </div>
    </div>
  );
}

export default NavigationSidebar;
