import { useState } from "react";
import { ChatIcon } from "../icons";
import { TabType } from "../types";

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
    <div className="navigation-sidebar">
      <div className="sidebar-header">
        <div className="logo">TRI</div>
        <button className="new-chat-button" onClick={() => console.log("New chat")}>
          + New Chat
        </button>
      </div>

      <div className="chat-history">
        {chatHistory.length > 0 ? (
          chatHistory.map((chat) => (
            <div
              key={chat.id}
              className="chat-history-item"
              onClick={() => console.log(`Clicked chat: ${chat.id}`)}
            >
              <ChatIcon />
              <div className="chat-title">{chat.title}</div>
            </div>
          ))
        ) : (
          <div className="no-history-message">
            No chat history yet
            {contextItemsCount > 0 && (
              <div className="context-indicator">Current context items: {contextItemsCount}</div>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button
          className="settings-button"
          onClick={() => console.log("Settings clicked")}
          title="Settings"
        >
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}

export default NavigationSidebar;
