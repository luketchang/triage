import { useEffect } from "react";
import { ChatIcon, SettingsIcon } from "../icons/index.jsx";
import { FaPlus } from "react-icons/fa";
import { TabType } from "../types/index.js";
import { Button } from "./ui/button.jsx";
import { ScrollArea } from "./ui/scroll-area.jsx";

// Import stores
import { useChatStore } from "../store/index.js";

interface NavigationSidebarProps {
  activeTab: TabType;
  handleTabChange: (tab: TabType) => void;
}

function NavigationSidebar({ activeTab, handleTabChange }: NavigationSidebarProps) {
  // Get state from stores
  const { chats, contextItems, currentChatId, selectChat, loadChats } = useChatStore();

  // Ensure chats are loaded when component mounts
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Make sure to keep the chat tab active
  if (activeTab !== "chat") {
    handleTabChange("chat");
  }

  // Handle creating a new chat
  const handleCreateChat = async () => {
    // Set chat ID to 0 to indicate a new chat should be created when a message is sent
    selectChat(undefined);
  };

  // Handle selecting a chat
  const handleSelectChat = (chatId: number) => {
    selectChat(chatId);
  };

  return (
    <div className="w-60 h-full bg-background-sidebar border-r border-border flex flex-col">
      <div className="p-4 flex flex-col gap-4">
        <div className="text-primary font-bold text-center text-lg">TRIAGE</div>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={handleCreateChat}>
          <FaPlus size={12} /> New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {chats.length > 0 ? (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`flex items-center p-2 rounded-md hover:bg-background-lighter cursor-pointer mb-1 text-gray-200 group ${
                  currentChatId === chat.id ? "bg-background-lighter" : ""
                }`}
                onClick={() => handleSelectChat(chat.id)}
              >
                <ChatIcon className="w-4 h-4 mr-2 text-gray-400 group-hover:text-white" />
                <div className="text-sm truncate">Chat {chat.id}</div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 text-sm p-4">No chat history yet</div>
          )}
        </div>
      </ScrollArea>

      {contextItems.length > 0 && (
        <div className="text-xs text-primary p-2 text-center">
          {contextItems.length} context item{contextItems.length !== 1 ? "s" : ""} active
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
