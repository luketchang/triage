// Load environment variables first, before any other imports
import "./env-loader.js";

import { ChatMessage as AgentChatMessage, invokeAgent } from "@triage/agent";
import { app, BrowserWindow, ipcMain, shell } from "electron";
// Fix CommonJS import for electron-updater
import pkg from "electron-updater";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
const { autoUpdater } = pkg;
// Import config from @triage/config package
import { config } from "@triage/config";
// Import AgentConfig type from local config interface
import { AgentConfig } from "../src/config.js";
// Import observability platform functions
import { getObservabilityPlatform, IntegrationType } from "@triage/observability";
import { AgentAssistantMessage } from "../src/renderer/types/index.js";

// Get directory name for preload script path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log the configuration to verify it's correctly loaded
console.log("Using environment configuration:", {
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
      preload: path.join(__dirname, "../../dist-electron/index.js"),
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
 * Set up IPC handlers for communication with the renderer
 */
function setupIpcHandlers(): void {
  // Handle agent invocation
  ipcMain.handle(
    "invoke-agent",
    async (
      _event: any,
      query: string,
      chatHistory: AgentChatMessage[],
      options?: { reasonOnly?: boolean }
    ): Promise<AgentAssistantMessage> => {
      try {
        console.log("Invoking agent with query:", query);
        console.log("IPC chat history:", chatHistory);

        // TODO: Don't extract these from env
        const agentConfig: AgentConfig = {
          repoPath: process.env.REPO_PATH!,
          codebaseOverviewPath: process.env.CODEBASE_OVERVIEW_PATH!,
          observabilityPlatform: process.env.OBSERVABILITY_PLATFORM!,
          observabilityFeatures: process.env.OBSERVABILITY_FEATURES!.split(","),
          // TODO: These should be loaded based on time range extracted from query
          startDate: new Date(process.env.START_DATE!),
          endDate: new Date(process.env.END_DATE!),
        };

        // Get reasonOnly flag from options
        const finalReasonOnly = options?.reasonOnly === true;

        // Send updates to renderer via mainWindow
        const onUpdate = (update: any) => {
          if (mainWindow) {
            mainWindow.webContents.send("agent-update", update);
          }
        };

        const result = await invokeAgent({
          query,
          chatHistory,
          repoPath: agentConfig.repoPath,
          codebaseOverviewPath: agentConfig.codebaseOverviewPath,
          observabilityPlatform: agentConfig.observabilityPlatform,
          observabilityFeatures: agentConfig.observabilityFeatures,
          startDate: agentConfig.startDate,
          endDate: agentConfig.endDate,
          reasonOnly: finalReasonOnly,
          onUpdate: onUpdate,
        });

        return result;
      } catch (error) {
        console.error("Error invoking agent:", error);
        throw error;
      }
    }
  );

  // Get the current agent configuration
  ipcMain.handle("get-agent-config", async (): Promise<AgentConfig> => {
    return {
      repoPath: process.env.REPO_PATH || "/Users/luketchang/code/ticketing",
      codebaseOverviewPath:
        process.env.CODEBASE_OVERVIEW_PATH ||
        "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md",
      observabilityPlatform: process.env.OBSERVABILITY_PLATFORM || "datadog",
      observabilityFeatures: process.env.OBSERVABILITY_FEATURES
        ? process.env.OBSERVABILITY_FEATURES.split(",")
        : ["logs"],
      startDate: new Date(process.env.START_DATE || "2025-04-16T21:00:00Z"),
      endDate: new Date(process.env.END_DATE || "2025-04-16T23:59:59Z"),
    };
  });

  // Update the agent configuration
  ipcMain.handle(
    "update-agent-config",
    async (_event: any, newConfig: Partial<AgentConfig>): Promise<AgentConfig> => {
      // Store updated values in process.env for future access
      if (newConfig.repoPath) {
        process.env.REPO_PATH = newConfig.repoPath;
      }
      if (newConfig.codebaseOverviewPath) {
        process.env.CODEBASE_OVERVIEW_PATH = newConfig.codebaseOverviewPath;
      }
      if (newConfig.observabilityPlatform) {
        process.env.OBSERVABILITY_PLATFORM = newConfig.observabilityPlatform;
      }
      if (newConfig.observabilityFeatures) {
        process.env.OBSERVABILITY_FEATURES = newConfig.observabilityFeatures.join(",");
      }
      if (newConfig.startDate) {
        process.env.START_DATE = newConfig.startDate.toISOString();
      }
      if (newConfig.endDate) {
        process.env.END_DATE = newConfig.endDate.toISOString();
      }

      // Return the updated configuration
      return {
        repoPath: process.env.REPO_PATH || "/Users/luketchang/code/ticketing",
        codebaseOverviewPath:
          process.env.CODEBASE_OVERVIEW_PATH ||
          "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md",
        observabilityPlatform: process.env.OBSERVABILITY_PLATFORM || "datadog",
        observabilityFeatures: process.env.OBSERVABILITY_FEATURES
          ? process.env.OBSERVABILITY_FEATURES.split(",")
          : ["logs"],
        startDate: new Date(process.env.START_DATE || "2025-04-16T21:00:00Z"),
        endDate: new Date(process.env.END_DATE || "2025-04-16T23:59:59Z"),
      };
    }
  );

  // Fetch logs based on query parameters
  ipcMain.handle("fetch-logs", async (_event: any, params: any) => {
    try {
      console.log("Fetching logs with params:", params);

      // Get the configured observability platform
      const platformType =
        (process.env.OBSERVABILITY_PLATFORM as IntegrationType) || IntegrationType.DATADOG;

      // Get the observability platform implementation
      const platform = getObservabilityPlatform(platformType);

      // Call the real platform API
      const result = await platform.fetchLogs({
        query: params.query || "",
        start: params.start,
        end: params.end,
        limit: params.limit || 500,
        pageCursor: params.pageCursor,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error("Error fetching logs:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Get log facet values for a given time range
  ipcMain.handle("get-logs-facet-values", async (_event: any, start: string, end: string) => {
    try {
      console.log("Getting log facet values for time range:", { start, end });

      // Get the configured observability platform
      const platformType =
        (process.env.OBSERVABILITY_PLATFORM as IntegrationType) || IntegrationType.DATADOG;

      // Get the observability platform implementation
      const platform = getObservabilityPlatform(platformType);

      // Call the real platform API
      const logFacetsMap = await platform.getLogsFacetValues(start, end);

      // Convert the Map<string, string[]> to FacetData[] format
      const facetsArray = Array.from(logFacetsMap.entries()).map(([name, values]) => {
        // Create counts array with same length as values (with placeholder values of 1)
        const counts = new Array(values.length).fill(1);
        return { name, values, counts };
      });

      return {
        success: true,
        data: facetsArray,
      };
    } catch (error) {
      console.error("Error getting log facet values:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Fetch traces based on query parameters
  ipcMain.handle("fetch-traces", async (_event: any, params: any) => {
    try {
      console.log("Fetching traces with params:", params);

      // Get the configured observability platform
      const platformType =
        (process.env.OBSERVABILITY_PLATFORM as IntegrationType) || IntegrationType.DATADOG;

      // Get the observability platform implementation
      const platform = getObservabilityPlatform(platformType);

      // Call the real platform API (assuming the method exists)
      const result = await platform.fetchTraces({
        query: params.query || "",
        start: params.start,
        end: params.end,
        limit: params.limit || 1000,
        pageCursor: params.pageCursor,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error("Error fetching traces:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Get span facet values for a given time range
  ipcMain.handle("get-spans-facet-values", async (_event: any, start: string, end: string) => {
    try {
      console.log("Getting span facet values for time range:", { start, end });

      // Get the configured observability platform
      const platformType =
        (process.env.OBSERVABILITY_PLATFORM as IntegrationType) || IntegrationType.DATADOG;

      // Get the observability platform implementation
      const platform = getObservabilityPlatform(platformType);

      // Call the real platform API (assuming the method exists)
      const spanFacetsMap = await platform.getSpansFacetValues(start, end);

      // Convert the Map<string, string[]> to FacetData[] format
      const facetsArray = Array.from(spanFacetsMap.entries()).map(([name, values]) => {
        // Create counts array with same length as values (with placeholder values of 1)
        const counts = new Array(values.length).fill(1);
        return { name, values, counts };
      });

      return {
        success: true,
        data: facetsArray,
      };
    } catch (error) {
      console.error("Error getting span facet values:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

/**
 * Helper function to recursively get directory tree
 */
async function getDirectoryTree(dirPath: string, basePath: string = ""): Promise<any[]> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const result: any[] = [];

  for (const entry of entries) {
    // Skip hidden files and node_modules
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }

    const relativePath = path.join(basePath, entry.name);
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Process directory
      const children = await getDirectoryTree(fullPath, relativePath);
      result.push({
        name: entry.name,
        path: relativePath,
        isDirectory: true,
        children: children,
      });
    } else {
      // Process file
      result.push({
        name: entry.name,
        path: relativePath,
        isDirectory: false,
      });
    }
  }

  return result;
}

/**
 * Initialize the application
 */
function init(): void {
  setupIpcHandlers();
  createWindow();
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
