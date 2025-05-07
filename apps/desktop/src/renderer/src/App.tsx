// @ts-ignore - Ignoring React module resolution issues
import { useState } from "react";
import "./electron.d";
import "./tailwind.css";

import { TabType } from "./types";

// Components
import NavigationSidebar from "./components/NavigationSidebar";

// Feature Views
import ChatView from "./features/ChatView";

// Custom hooks
import { useChat } from "./hooks/useChat";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

// Context Provider
import { AppConfigProvider } from "./context/AppConfigContext.js";

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [showFactsSidebar, setShowFactsSidebar] = useState(false);

  // Use custom hooks
  const chatState = useChat();

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

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  return (
    <AppConfigProvider>
      <div className="flex w-full h-full bg-background">
        <NavigationSidebar
          activeTab={activeTab}
          handleTabChange={handleTabChange}
          contextItemsCount={chatState.contextItems?.length || 0}
        />

        <div className="flex-1 h-full overflow-hidden flex">
          <div className={`${showFactsSidebar ? "flex-1" : "w-full"} h-full overflow-hidden`}>
            <ChatView />
          </div>
        </div>
      </div>
    </AppConfigProvider>
  );
}

export default App;
