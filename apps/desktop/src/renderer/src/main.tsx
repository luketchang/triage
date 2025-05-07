/**
 * Main entry point for the renderer process
 */
import ReactDOM from "react-dom/client";
import App from "./App";

// Import Electron types to ensure proper TypeScript checks
import "./electron.d";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // TODO: turn StrictMode back on once we figure out how to deal with streaming
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);
