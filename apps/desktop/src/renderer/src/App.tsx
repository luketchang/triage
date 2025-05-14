import "./styles/globals.css";

// Components
import NavigationSidebar from "./components/NavigationSidebar.js";

// Feature Views
import ChatView from "./features/ChatView.js";

// Context Provider
import { AppConfigProvider } from "./context/AppConfigContext.js";
import SettingsView from "./features/SettingsView.js";
import "./styles/globals.css";

// Stores
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { useUIStore } from "./store/index.js";

function App(): JSX.Element {
  // Get required state from stores
  const { activeTab, showFactsSidebar, toggleFactsSidebar } = useUIStore();

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

  return (
    <AppConfigProvider>
      <div className="flex w-full h-full bg-background antialiased">
        <NavigationSidebar />

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
