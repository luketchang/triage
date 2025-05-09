import { useState } from "react";
import NavigationSidebar from "./components/NavigationSidebar.js";
import { AppConfigProvider } from "./context/AppConfigContext.js";
import ChatView from "./features/ChatView.js";
import SettingsView from "./features/SettingsView.js";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts.js";
import "./styles/globals.css";
import { TabType } from "./types/index.js";

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [showFactsSidebar, setShowFactsSidebar] = useState(false);

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

  return (
    <AppConfigProvider>
      <div className="flex w-full h-full bg-background antialiased">
        <NavigationSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="flex-1 h-full overflow-hidden flex shadow-sm">
          <div
            className={`${showFactsSidebar ? "flex-1" : "w-full"} h-full overflow-hidden transition-standard`}
          >
            {renderActiveTabContent()}
          </div>
        </div>
      </div>
    </AppConfigProvider>
  );
}

export default App;
