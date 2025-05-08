import { useEffect, useState } from "react";
import { ChatIcon, SettingsIcon } from "../icons/index.jsx";
import api from "../services/api.js";
import { Chat, TabType } from "../types/index.js";
import { Button } from "./ui/button.jsx";
import { ScrollArea } from "./ui/scroll-area.jsx";

import { useChat } from "@renderer/hooks/useChat.js";
import { FaPlus } from "react-icons/fa";
// removed unused import

interface NavigationSidebarProps {
  activeTab: TabType;
  handleTabChange: (tab: TabType) => void;
  contextItemsCount: number;
  selectedChatId?: number;
  onSelectChat: (chatId: number) => void;
  refreshTrigger?: number;
}

function NavigationSidebar({
  activeTab,
  handleTabChange,
  contextItemsCount,
  selectedChatId,
  onSelectChat,
  refreshTrigger,
}: NavigationSidebarProps) {
  // State for chat history
  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Function to fetch chats
  const fetchChats = async () => {
    setIsLoading(true);
    try {
      console.info("Fetching chats from API...");
      const chats = await api.getAllChats();
      console.info("Fetched chats:", chats);
      setChatHistory(chats);
    } catch (error) {
      console.error("Error creating chat:", error);
      console.error("Error fetching chats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch chat list on component mount and when refreshTrigger changes
  useEffect(() => {
    console.info("NavigationSidebar: refreshTrigger changed:", refreshTrigger);
    fetchChats();
  }, [refreshTrigger]);

  // Make sure to keep the chat tab active
  if (activeTab !== "chat") {
    handleTabChange("chat");
  }

  // Handle creating a new chat
  const handleCreateChat = () => {
    // Now we just clear the selection and let the message sending create the actual chat
    onSelectChat(0); // Use 0 or undefined to indicate no chat is selected
  };

  // Handle selecting a chat
  const handleSelectChat = (chatId: number) => {
    onSelectChat(chatId);
  };

  return (
    <div className="w-60 h-full bg-background-sidebar border-r border-border flex flex-col">
      <div className="p-4 flex flex-col gap-4">
        <div className="text-primary font-bold text-center text-lg">TRIAGE</div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleCreateChat}
          disabled={isLoading}
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
                className={`flex items-center p-2 rounded-md hover:bg-background-lighter cursor-pointer mb-1 text-gray-200 group ${
                  selectedChatId === chat.id ? "bg-background-lighter" : ""
                }`}
                onClick={() => handleSelectChat(chat.id)}
              >
                <ChatIcon className="w-4 h-4 mr-2 text-gray-400 group-hover:text-white" />
                <div className="text-sm truncate">New Chat</div>
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
