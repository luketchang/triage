/**
 * Main entry point for the renderer process
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Import Electron types to ensure proper TypeScript checks
import "./electron.d";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
