import { invokeAgent } from "@triage/agent";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { join } from "path";
import { AgentConfig, defaultConfig } from "./config";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, "../dist-electron/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Load the index.html when not in development
    mainWindow.loadFile(join(process.env.DIST || "dist", "index.html"));
  }

  // Make all links open with the browser, not with the application
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Auto updater
  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Define IPC handlers for agent communication
ipcMain.handle("invoke-agent", async (event, query) => {
  try {
    console.log("Invoking agent with query:", query);
    const result = await invokeAgent({
      query,
      repoPath: defaultConfig.repoPath,
      codebaseOverviewPath: defaultConfig.codebaseOverviewPath,
      observabilityPlatform: defaultConfig.observabilityPlatform,
      observabilityFeatures: defaultConfig.observabilityFeatures,
      startDate: defaultConfig.startDate,
      endDate: defaultConfig.endDate,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error invoking agent:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

// Get the current agent configuration
ipcMain.handle("get-agent-config", async (): Promise<AgentConfig> => {
  return defaultConfig;
});

// Update the agent configuration
ipcMain.handle(
  "update-agent-config",
  async (event, newConfig: Partial<AgentConfig>): Promise<AgentConfig> => {
    // In a production app, you might want to persist this configuration
    // For now, we'll just merge with the existing config
    return { ...defaultConfig, ...newConfig };
  }
);
