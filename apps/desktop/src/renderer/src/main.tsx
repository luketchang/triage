/**
 * Main entry point for the renderer process
 */
import * as Sentry from "@sentry/electron/renderer";

import ReactDOM from "react-dom/client";
import App from "./App.js";

if (process.env.NODE_ENV === "production") {
  console.info("Initializing Sentry");
  Sentry.init({
    // Adds request headers and IP for users, for more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/electron/configuration/options/#sendDefaultPii
    dsn: "https://0959c176189c84d818acd95b7add26ac@o4509322414063616.ingest.us.sentry.io/4509322496180224",
    sendDefaultPii: true,
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ["error"] }),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    replaysSessionSampleRate: 0.1, // Default 10%
    replaysOnErrorSampleRate: 1.0,
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  // TODO: turn StrictMode back on once we figure out how to deal with streaming
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);
