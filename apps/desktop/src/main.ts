import { OnCallAgent } from "@triage/agent";
import { logger, OpenAIModel } from "@triage/common";
import { getObservabilityPlatform, IntegrationType } from "@triage/observability";
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect development mode
const isDevelopment = process.env.NODE_ENV === "development" || !app.isPackaged;

// Keep a global reference of the window object to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the app - differently based on dev or production
  if (isDevelopment) {
    // Load from Vite dev server in development
    await mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    // Load the built HTML file in production
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    // On macOS, re-create a window when dock icon is clicked and no other windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });

  // Set up IPC handlers
  setupIPC();
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function setupIPC() {
  ipcMain.handle("invoke-agent", async (_, issue: string, repoPath: string) => {
    try {
      logger.info("Starting agent invocation with issue:", issue);

      // Set up the observability platform (using Grafana as default)
      const integrationType = IntegrationType.GRAFANA;
      const observabilityPlatform = getObservabilityPlatform(integrationType);
      const observabilityFeatures = ["logs"];

      // Example time range for logs
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 1);
      const endDate = new Date();

      // Get labels map
      const logLabelsMap = await observabilityPlatform.getLogsFacetValues(
        startDate.toISOString(),
        endDate.toISOString()
      );
      const spanLabelsMap = await observabilityPlatform.getSpansFacetValues(
        startDate.toISOString(),
        endDate.toISOString()
      );

      // Generate file tree
      const fileTree = ""; // In a real implementation, you'd call loadFileTree(repoPath)

      // Initialize models
      const reasoningModel = OpenAIModel.O3_MINI;
      const fastModel = OpenAIModel.GPT_4O;

      // Create and invoke agent
      const agent = new OnCallAgent(
        reasoningModel,
        fastModel,
        observabilityPlatform,
        observabilityFeatures
      );

      const response = await agent.invoke({
        firstPass: true,
        toolCalls: observabilityFeatures.includes("logs")
          ? [
              {
                type: "logRequest",
                request: "fetch logs relevant to the issue/event",
                reasoning: "",
              },
            ]
          : [{ type: "reasoningRequest" }],
        query: issue,
        repoPath,
        codebaseOverview: "",
        fileTree,
        logLabelsMap,
        spanLabelsMap,
        chatHistory: [],
        codeContext: new Map(),
        logContext: new Map(),
        spanContext: new Map(),
        rootCauseAnalysis: null,
        logPostprocessingResult: null,
        codePostprocessingResult: null,
      });

      return {
        success: true,
        chatHistory: response.chatHistory,
        rootCauseAnalysis: response.rca,
        logPostprocessing: response.logPostprocessing,
        codePostprocessing: response.codePostprocessing,
      };
    } catch (error) {
      logger.error("Error invoking agent:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
