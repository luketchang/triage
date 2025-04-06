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
  console.log("Creating main window");

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      // Enable development tools in all environments for debugging
      devTools: true,
    },
  });

  // Always open DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Log all console messages from the renderer to the main process console
  mainWindow.webContents.on("console-message", (_, level, message, line, sourceId) => {
    const levels = ["verbose", "info", "warning", "error"];
    console.log(`[${levels[level] || "info"}] (${sourceId}:${line}): ${message}`);
  });

  // Load the app - differently based on dev or production
  if (isDevelopment) {
    console.log("Development mode: Loading from http://localhost:3000");

    // In development, load from Vite dev server
    try {
      await mainWindow.loadURL("http://localhost:3000");
      console.log("Successfully loaded from development server");
    } catch (error) {
      console.error("Failed to load from development server:", error);

      // Show error message in the window
      mainWindow.loadURL(`data:text/html,
        <html>
          <head><title>Development Server Error</title></head>
          <body style="font-family: Arial; padding: 20px; background: #f8f8f8;">
            <h2>Failed to connect to development server</h2>
            <p>Make sure Vite is running on port 3000.</p>
            <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
            <script>
              // Reload every 3 seconds to attempt reconnection
              setTimeout(() => location.reload(), 3000);
            </script>
          </body>
        </html>
      `);
    }
  } else {
    console.log("Production mode: Loading from file");

    // In production, load the HTML file from the renderer directory
    try {
      const indexPath = path.join(__dirname, "../renderer", "index.html");
      console.log("Loading index.html from:", indexPath);
      await mainWindow.loadFile(indexPath);
      console.log("Successfully loaded index.html from file");
    } catch (error) {
      console.error("Failed to load index.html from file:", error);

      // Show error message in the window
      mainWindow.loadURL(`data:text/html,
        <html>
          <head><title>Error Loading App</title></head>
          <body style="font-family: Arial; padding: 20px; background: #f8f8f8;">
            <h2>Failed to load application</h2>
            <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
          </body>
        </html>
      `);
    }
  }

  // Log window load errors
  mainWindow.webContents.on("did-fail-load", (_, errorCode, errorDescription) => {
    console.error("Failed to load content:", errorCode, errorDescription);
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  console.log("Electron app ready, creating window");
  await createWindow();

  app.on("activate", async () => {
    // On macOS, re-create a window when dock icon is clicked and no other windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Basic IPC setup
ipcMain.handle("get-path", (_, name) => {
  return app.getPath(name as any);
});

ipcMain.handle("getCurrentDirectory", () => {
  return process.cwd();
});
