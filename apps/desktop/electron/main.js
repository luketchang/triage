import { invokeAgent } from "@triage/agent";
import { app, BrowserWindow, ipcMain } from "electron";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import desktopConfig from "../src/desktop-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration with environment variable fallbacks
const agentConfig = desktopConfig.agent;

// Log the configuration to verify it's correctly loaded
console.log("Using environment configuration:", {
  NODE_ENV: desktopConfig.env,
  openaiApiKey: desktopConfig.openaiApiKey ? "Set" : "Not set",
  anthropicApiKey: desktopConfig.anthropicApiKey ? "Set" : "Not set",
  datadog: {
    apiKey: desktopConfig.datadog.apiKey ? "Set" : "Not set",
    appKey: desktopConfig.datadog.appKey ? "Set" : "Not set",
  },
  grafana: {
    baseUrl: desktopConfig.grafana.baseUrl,
    username: desktopConfig.grafana.username ? "Set" : "Not set",
  },
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../dist-electron/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // In development, load from dev server
  if (process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true") {
    mainWindow.loadURL("http://localhost:5174");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built html file
    const indexPath = path.join(__dirname, "../dist/index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Define IPC handlers for agent communication
function setupIpcHandlers() {
  // Handle agent invocation
  ipcMain.handle("invoke-agent", async (event, query) => {
    try {
      console.log("Invoking agent with query:", query);
      const result = await invokeAgent({
        query,
        repoPath: agentConfig.repoPath,
        codebaseOverviewPath: agentConfig.codebaseOverviewPath,
        observabilityPlatform: agentConfig.observabilityPlatform,
        observabilityFeatures: agentConfig.observabilityFeatures,
        startDate: agentConfig.startDate,
        endDate: agentConfig.endDate,
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
  ipcMain.handle("get-agent-config", async () => {
    return agentConfig;
  });

  // Update the agent configuration
  ipcMain.handle("update-agent-config", async (event, newConfig) => {
    // For now, we'll just merge with the existing config
    Object.assign(agentConfig, newConfig);
    return agentConfig;
  });
}

// App initialization
function init() {
  setupIpcHandlers();
  createWindow();
}

// Event listeners
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
