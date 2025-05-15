/**
 * Main entry point for the renderer process
 */
import * as Sentry from "@sentry/electron/renderer";

import ReactDOM from "react-dom/client";
import App from "./App.js";

Sentry.init({
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/electron/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  // TODO: turn StrictMode back on once we figure out how to deal with streaming
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);
