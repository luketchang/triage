import { contextBridge, ipcRenderer } from "electron";

// Expose simplified API to the renderer process
contextBridge.exposeInMainWorld("api", {
  // Get the current working directory
  getCurrentDirectory: () => {
    return ipcRenderer.invoke("getCurrentDirectory");
  },

  // Get an app path
  getPath: (name: string) => {
    return ipcRenderer.invoke("get-path", name);
  },

  // Expose some system info for debugging
  getSystemInfo: () => {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      userAgent: navigator.userAgent,
    };
  },
});
