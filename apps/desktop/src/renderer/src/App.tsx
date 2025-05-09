// @ts-ignore - Ignoring React module resolution issues
import "./electron.d";
import "./styles/globals.css";

// Components
import NavigationSidebar from "./components/NavigationSidebar.js";

// Feature Views
import ChatView from "./features/ChatView.js";

// Custom hooks
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";

// Context Provider
import { AppConfigProvider } from "./context/AppConfigContext.js";
import ChatView from "./features/ChatView.js";
import SettingsView from "./features/SettingsView.js";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import "./styles/globals.css";
import { TabType } from "./types/index.js";

// Stores
import { useUIStore } from "./store/index.js";

function App(): JSX.Element {
  // Get required state from stores
  const { activeTab, showFactsSidebar, setActiveTab, toggleFactsSidebar } = useUIStore();

  // Set up keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "f",
      metaKey: true,
      action: toggleFactsSidebar,
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
        <NavigationSidebar activeTab={activeTab} handleTabChange={setActiveTab} />

        <div className="flex-1 h-full overflow-hidden flex shadow-sm">
          <div
            className={`${showFactsSidebar ? "flex-1" : "w-full"} h-full overflow-hidden transition-standard`}
          >
            <ChatView />
          </div>
        </div>
      </div>
    </AppConfigProvider>
  );
}

export default App;
