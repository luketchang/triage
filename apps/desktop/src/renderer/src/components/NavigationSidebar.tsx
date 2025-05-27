import { NO_CHAT_SELECTED } from "@renderer/store/chatStore.js";
import { MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { useEffect } from "react";
import { FaPlus } from "react-icons/fa";
import { ChatIcon, SettingsIcon } from "../icons/index.jsx";
import { useChatStore, useUIStore } from "../store/index.js";
import { Button } from "./ui/Button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu.jsx";
import { ScrollArea } from "./ui/ScrollArea.jsx";

function NavigationSidebar() {
  const chats = useChatStore.use.chats();
  const currentChatId = useChatStore.use.currentChatId();
  const selectChat = useChatStore.use.selectChat();
  const loadChats = useChatStore.use.loadChats();
  const deleteChat = useChatStore.use.deleteChat();
  const activeTab = useUIStore.use.activeTab();
  const setActiveTab = useUIStore.use.setActiveTab();

  // Ensure chats are loaded when component mounts
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Clicking "New Chat" causes unselected chat to be
  const handleNewChat = async () => {
    selectChat(NO_CHAT_SELECTED);
    setActiveTab("chat");
  };

  // Handle selecting a chat
  const handleSelectChat = (chatId: number) => {
    selectChat(chatId);
    setActiveTab("chat");
  };

  return (
    <div className="w-60 h-full bg-background-sidebar border-r border-border flex flex-col">
      <div className="p-4 flex flex-col gap-4">
        <div className="text-primary font-bold text-center text-lg">TRIAGE</div>
        <Button variant="outline" className="w-full justify-start gap-2" onClick={handleNewChat}>
          <FaPlus size={12} /> New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {chats.length > 0 ? (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`flex items-center justify-between p-2 rounded-md text-gray-200 group cursor-pointer min-h-[40px] ${
                  currentChatId === chat.id ? "bg-background-alt" : "hover:bg-background-lighter"
                }`}
                onClick={() => handleSelectChat(chat.id)}
              >
                <div className="flex items-center flex-grow min-h-full">
                  <ChatIcon className="w-4 h-4 mr-2 text-gray-400 group-hover:text-white" />
                  <div className="text-sm truncate">Chat {chat.id}</div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 hover:bg-background-alt"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontalIcon className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[150px]">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      className="text-red-500 cursor-pointer flex items-center gap-2"
                    >
                      <Trash2Icon className="h-4 w-4" />
                      Delete chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 text-sm p-4">No chat history yet</div>
          )}
        </div>
      </ScrollArea>

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
