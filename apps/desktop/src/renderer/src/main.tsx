/**
 * Main entry point for the renderer process
 */
import * as Sentry from "@sentry/electron/renderer";

import ReactDOM from "react-dom/client";
import App from "./App.js";

Sentry.init({
  dsn: "https://0959c176189c84d818acd95b7add26ac@o4509322414063616.ingest.us.sentry.io/4509322496180224",
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
