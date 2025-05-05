// Load environment variables first, before any other imports
import "./env-loader.js";

import { app, BrowserWindow, shell } from "electron";
// Fix CommonJS import for electron-updater
import pkg from "electron-updater";
import * as path from "path";
const { autoUpdater } = pkg;
// Import config from @triage/config package
import { config } from "@triage/config";
// Import all handlers from the handlers directory
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

// Log the configuration to verify it's correctly loaded
console.info("Using environment configuration:", {
  NODE_ENV: config.env,
  openaiApiKey: config.openaiApiKey ? "Set" : "Not set",
  anthropicApiKey: config.anthropicApiKey ? "Set" : "Not set",
  datadog: {
    apiKey: config.datadog.apiKey ? "Set" : "Not set",
    appKey: config.datadog.appKey ? "Set" : "Not set",
  },
  grafana: {
    baseUrl: config.grafana.baseUrl,
    username: config.grafana.username ? "Set" : "Not set",
  },
});

let mainWindow: BrowserWindow | null;

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // TODO: double check if this is correct
      preload: path.resolve(process.cwd(), "dist-electron/preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // In development, load from dev server
  if (process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true") {
    mainWindow.loadURL("http://localhost:5174");
    mainWindow.webContents.openDevTools();
  } else {
    // Load the index.html when not in development
    mainWindow.loadFile(path.join(process.env.DIST || "dist", "index.html"));
  }

  // Make all links open with the browser, not with the application
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Auto updater in production
  if (process.env.NODE_ENV === "production") {
    autoUpdater.checkForUpdatesAndNotify();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Initialize the application
 */
function init(): void {
  // Create window first
  createWindow();

  // Now set up all IPC handlers, with mainWindow available
  if (mainWindow) {
    setupAgentHandlers(mainWindow);
  } else {
    console.error("Failed to initialize agent handlers: mainWindow is null");
  }
  setupDbHandlers();
  setupObservabilityHandlers();
  setupConfigHandlers();
}

// App lifecycle event handlers
app.whenReady().then(init);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Clean up handlers when app quits
app.on("quit", () => {
  cleanupDbHandlers();
  cleanupAgentHandlers();
  cleanupObservabilityHandlers();
  cleanupConfigHandlers();
});
