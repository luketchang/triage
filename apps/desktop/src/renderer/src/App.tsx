import { useState } from "react";
import NavigationSidebar from "./components/NavigationSidebar.js";
import { AppConfigProvider } from "./context/AppConfigContext.js";
import ChatView from "./features/ChatView.js";
import SettingsView from "./features/SettingsView.js";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import "./styles/globals.css";
import { TabType } from "./types/index.js";

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [showFactsSidebar, setShowFactsSidebar] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<number | undefined>(undefined);
  const [refreshNavTrigger, setRefreshNavTrigger] = useState(0);

  // Handle when new chat is created
  const handleChatCreated = (chatId: number) => {
    // Update the selected chat ID
    setSelectedChatId(chatId);
    // Trigger a navigation refresh by incrementing the trigger
    setRefreshNavTrigger((prev) => prev + 1);
  };

  // Use custom hooks
  const chatState = useChat({
    selectedChatId,
    onChatCreated: handleChatCreated,
  });

  // Setup keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "f",
      metaKey: true,
      action: () => {
        setShowFactsSidebar((prev) => !prev);
      },
    },
  ]);

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case "settings":
        return <SettingsView />;
      case "chat":
      default:
        return <ChatView />;
    }
  };

  const handleSelectChat = (chatId: number) => {
    setSelectedChatId(chatId);
  };

  return (
    <AppConfigProvider>
      <div className="flex w-full h-full bg-background antialiased">
        <NavigationSidebar
          activeTab={activeTab}
          handleTabChange={handleTabChange}
          contextItemsCount={chatState.contextItems?.length || 0}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          refreshTrigger={refreshNavTrigger}
        />

        <div className="flex-1 h-full overflow-hidden flex shadow-sm">
          <div
            className={`${showFactsSidebar ? "flex-1" : "w-full"} h-full overflow-hidden transition-standard`}
          >
            <ChatView selectedChatId={selectedChatId} onChatCreated={handleChatCreated} />
          </div>
        </div>
      </div>
    </AppConfigProvider>
  );
}

export default App;
