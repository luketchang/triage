// Load environment variables first, before any other imports
import "./env-loader";

import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { invokeAgent } from "@triage/agent";
import { config } from "@triage/config";
import { getObservabilityPlatform, IntegrationType } from "@triage/observability";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { join } from "path";
import { AgentConfig } from "./config.js";

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
      serializedLogContext: any = null,
      options?: { reasonOnly?: boolean }
    ) => {
      try {
        console.log("Invoking agent with query:", query);

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

        // Convert serialized format back to Map if needed
        let logContext: Map<any, any> | undefined = undefined;
        if (serializedLogContext && Array.isArray(serializedLogContext)) {
          logContext = new Map(serializedLogContext);
        }

        const result = await invokeAgent({
          query,
          repoPath: agentConfig.repoPath,
          codebaseOverviewPath: agentConfig.codebaseOverviewPath,
          observabilityPlatform: agentConfig.observabilityPlatform,
          observabilityFeatures: agentConfig.observabilityFeatures,
          startDate: agentConfig.startDate,
          endDate: agentConfig.endDate,
          reasonOnly: finalReasonOnly,
          logContext: logContext,
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
 * Create the main application window
 */
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    // ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
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
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
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

  setupIpcHandlers();
  createWindow();

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
