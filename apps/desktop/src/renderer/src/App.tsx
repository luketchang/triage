import NavigationSidebar from "./components/NavigationSidebar.js";
import { AppConfigProvider } from "./context/AppConfigContext.js";
import ChatView from "./features/ChatView.js";
import SettingsView from "./features/SettingsView.js";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { useUIStore } from "./store/index.js";
import "./styles/globals.css";

function App(): JSX.Element {
  const activeTab = useUIStore.use.activeTab();
  const showFactsSidebar = useUIStore.use.showFactsSidebar();
  const toggleFactsSidebar = useUIStore.use.toggleFactsSidebar();

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
