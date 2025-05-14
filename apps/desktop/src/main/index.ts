import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { AgentConfigStore } from "@triage/agent";
import { ObservabilityConfigStore } from "@triage/observability";
import { app, BrowserWindow, shell } from "electron";
import electronUpdater from "electron-updater";
import path from "path";

import { AppCfgSchema, AppConfigStore } from "../common/AppConfig.js";
import { ElectronConfigStore } from "./ElectronConfigStore.js";
import {
  cleanupAgentHandlers,
  cleanupCodebaseHandlers,
  cleanupConfigHandlers,
  cleanupDbHandlers,
  cleanupObservabilityHandlers,
  setupAgentHandlers,
  setupCodebaseHandlers,
  setupConfigHandlers,
  setupDbHandlers,
  setupObservabilityHandlers,
} from "./handlers/index.js";
import { setupDesktopLogger } from "./setup/logger-setup.js";

// Define logger type for clarity, assuming it has an info method
interface DesktopLoggerType {
  info: (message: string) => void;
  error: (message: string) => void; // Assuming it also has error, adjust if not
}

let desktopLogger: DesktopLoggerType; // Declare here

/**
 * Create the main application window
 */
function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: path.join(app.getAppPath(), "out/preload/index.cjs"),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Make all links open with the browser, not with the application
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Auto updater in production
  if (process.env.NODE_ENV === "production") {
    electronUpdater.autoUpdater.checkForUpdatesAndNotify();
  }

  return mainWindow;
}

function initApp(mainWindow: BrowserWindow, logger: { info: (message: string) => void }): void {
  console.error("MAIN_INDEX_INITAPP_DIAGNOSTIC: Entered initApp function.");
  logger.info("MAIN_INDEX_INITAPP: Entered initApp function.");

  const configStore = new ElectronConfigStore(AppCfgSchema);
  console.error("MAIN_INDEX_INITAPP_DIAGNOSTIC: After new ElectronConfigStore");

  // Create specialized views for each schema
  const appCfgStore = new AppConfigStore(configStore);
  const agentCfgStore = new AgentConfigStore(configStore);
  const observabilityCfgStore = new ObservabilityConfigStore(configStore);
  console.error("MAIN_INDEX_INITAPP_DIAGNOSTIC: After creating specialized config stores");

  // Set up all IPC handlers
  console.error("MAIN_INDEX_INITAPP_DIAGNOSTIC: About to call setupAgentHandlers().");
  logger.info("MAIN_INDEX_INITAPP: About to call setupAgentHandlers().");
  setupAgentHandlers(mainWindow, agentCfgStore);
  console.error("MAIN_INDEX_INITAPP_DIAGNOSTIC: Returned from setupAgentHandlers().");
  logger.info("MAIN_INDEX_INITAPP: Returned from setupAgentHandlers().");

  console.error("MAIN_INDEX_INITAPP_DIAGNOSTIC: About to call setupDbHandlers().");
  logger.info("MAIN_INDEX_INITAPP: About to call setupDbHandlers().");
  setupDbHandlers();
  logger.info("MAIN_INDEX_INITAPP: Returned from setupDbHandlers().");

  console.error("MAIN_INDEX_INITAPP_DIAGNOSTIC: About to call setupConfigHandlers().");
  logger.info("MAIN_INDEX_INITAPP: About to call setupConfigHandlers().");
  setupConfigHandlers(appCfgStore);
  logger.info("MAIN_INDEX_INITAPP: Returned from setupConfigHandlers().");

  console.error("MAIN_INDEX_INITAPP_DIAGNOSTIC: About to call setupObservabilityHandlers().");
  logger.info("MAIN_INDEX_INITAPP: About to call setupObservabilityHandlers().");
  setupObservabilityHandlers(observabilityCfgStore);
  logger.info("MAIN_INDEX_INITAPP: Returned from setupObservabilityHandlers().");
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set up the logger early in the app startup
  desktopLogger = setupDesktopLogger(); // Assign here
  desktopLogger.info("Triage Desktop starting up...");
  console.error("MAIN_INDEX_DIAGNOSTIC: Immediately after initial desktopLogger.info");

  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");
  console.error("MAIN_INDEX_DIAGNOSTIC: After electronApp.setAppUserModelId");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    console.error("MAIN_INDEX_DIAGNOSTIC: 'browser-window-created' event triggered");
    optimizer.watchWindowShortcuts(window);
  });
  console.error("MAIN_INDEX_DIAGNOSTIC: After app.on('browser-window-created') setup");

  console.error("MAIN_INDEX_DIAGNOSTIC: About to call createWindow()...");
  const mainWindow = createWindow();
  console.error("MAIN_INDEX_DIAGNOSTIC: createWindow() returned. About to call initApp()...");
  initApp(mainWindow, desktopLogger);
  console.error("MAIN_INDEX_DIAGNOSTIC: initApp() returned.");

  app.on("activate", function () {
    console.error("MAIN_INDEX_DIAGNOSTIC: 'activate' event triggered");
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      console.error("MAIN_INDEX_DIAGNOSTIC: 'activate' event - creating window");
      createWindow();
    }
  });
  console.error("MAIN_INDEX_DIAGNOSTIC: After app.on('activate') setup");
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Clean up handlers when app quits
app.on("quit", () => {
  console.error("MAIN_INDEX_DIAGNOSTIC: 'quit' event triggered");
  if (desktopLogger) {
    // Check if logger was initialized
    cleanupAgentHandlers(); // Assuming cleanupAgentHandlers doesn't need logger yet
    cleanupDbHandlers();
    cleanupConfigHandlers();
    cleanupObservabilityHandlers();
  } else {
    console.error("MAIN_INDEX_DIAGNOSTIC: desktopLogger not initialized at quit.");
    // Fallback or silent fail if logger wasn't set up
    cleanupAgentHandlers();
    // Potentially call other cleanup handlers without logger if they are designed to handle it
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
