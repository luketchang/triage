import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Example of exposing an API to the renderer process
  // getLogs: (query: string) => ipcRenderer.invoke("get-logs", query),
  // getCode: (paths: string[]) => ipcRenderer.invoke("get-code", paths),
});

function domReady(condition: DocumentReadyState[] = ["complete", "interactive"]): Promise<boolean> {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true);
    } else {
      document.addEventListener("readystatechange", () => {
        if (condition.includes(document.readyState)) {
          resolve(true);
        }
      });
    }
  });
}

domReady().then(() => {
  // Add any preload initialization here
});
