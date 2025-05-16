import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { AgentConfigStore } from "@triage/agent";
import { logger } from "@triage/common";
import { ObservabilityConfigStore } from "@triage/observability";
import { app, BrowserWindow, dialog, shell } from "electron";
import electronUpdater from "electron-updater";
import path from "path";
import { AppCfgSchema, AppConfigStore } from "../common/AppConfig.js";
import { ElectronConfigStore } from "./ElectronConfigStore.js";
import { migrateDatabaseIfNeeded } from "./db/migrate.js";
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

function initApp(mainWindow: BrowserWindow): void {
  logger.info("Initializing application");

  const configStore = new ElectronConfigStore(AppCfgSchema);

  // Create specialized views for each schema
  const appCfgStore = new AppConfigStore(configStore);
  const agentCfgStore = new AgentConfigStore(configStore);
  const observabilityCfgStore = new ObservabilityConfigStore(configStore);

  // Set up all IPC handlers
  setupAgentHandlers(mainWindow, agentCfgStore);
  setupDbHandlers();
  setupCodebaseHandlers(mainWindow, appCfgStore);
  setupConfigHandlers(appCfgStore);
  setupObservabilityHandlers(observabilityCfgStore);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set up the logger early in the app startup
  setupDesktopLogger();

  logger.info("Triage Desktop starting up...");

  // Run database migrations before any DB operations
  try {
    logger.info("Running database migrations...");
    await migrateDatabaseIfNeeded();
    logger.info("Database migrations completed successfully");
  } catch (error: unknown) {
    logger.error("Failed to run database migrations, exiting application");
    dialog.showErrorBox(
      "Database Migration Failed",
      `Triage Desktop could not start because a database migration failed.\n\n${error instanceof Error ? error.message : String(error)}`
    );
    app.quit();
  }

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
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
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
app.on("before-quit", () => {
  logger.info("Application quitting, cleaning up handlers");
  cleanupAgentHandlers();
  cleanupCodebaseHandlers();
  cleanupDbHandlers();
  cleanupConfigHandlers();
  cleanupObservabilityHandlers();
});
