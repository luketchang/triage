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
  cleanupConfigHandlers,
  cleanupDbHandlers,
  cleanupObservabilityHandlers,
  setupAgentHandlers,
  setupConfigHandlers,
  setupDbHandlers,
  setupObservabilityHandlers,
} from "./handlers/index.js";

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

async function initApp(mainWindow: BrowserWindow): Promise<void> {
  const configStore = new ElectronConfigStore(AppCfgSchema);

  // Create specialized views for each schema
  const appCfgStore = new AppConfigStore(configStore);
  const agentCfgStore = new AgentConfigStore(configStore);
  const observabilityCfgStore = new ObservabilityConfigStore(configStore);

  // Set up all IPC handlers
  setupAgentHandlers(mainWindow, agentCfgStore);
  setupDbHandlers();
  setupConfigHandlers(appCfgStore);
  setupObservabilityHandlers(observabilityCfgStore);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  const mainWindow = createWindow();
  initApp(mainWindow);

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Clean up handlers when app quits
app.on("quit", () => {
  cleanupAgentHandlers();
  cleanupDbHandlers();
  cleanupConfigHandlers();
  cleanupObservabilityHandlers();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
