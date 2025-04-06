import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

// Immediately add debug text to the DOM
document.body.insertAdjacentHTML(
  "afterbegin",
  `<div style="background-color: yellow; padding: 10px; margin: 10px; position: fixed; top: 0; left: 0; z-index: 9999;">
    JavaScript is executing!
    <div id="debug-info">React initializing...</div>
  </div>`
);

// Update debug info
function updateDebugInfo(message: string) {
  const debugEl = document.getElementById("debug-info");
  if (debugEl) {
    debugEl.textContent = message;
  } else {
    console.error("Debug element not found");
  }
}

// Some debug output to verify JS is running
console.log("main.tsx started executing");

// Try to render React with HashRouter
try {
  console.log("Finding root element...");
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Root element not found");
  }

  console.log("Creating React root...");
  const root = ReactDOM.createRoot(rootElement);

  console.log("Rendering App with HashRouter...");
  root.render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );

  console.log("Render complete!");
} catch (error) {
  console.error("Error rendering application:", error);

  // Display error directly in the DOM
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div style="background-color: #ffeeee; color: red; padding: 20px; margin: 20px; border: 1px solid red;">
      <h3>Application Error</h3>
      <p>${error instanceof Error ? error.message : String(error)}</p>
      <pre>${error instanceof Error && error.stack ? error.stack : "No stack trace available"}</pre>
    </div>`
  );

  // Try to render a basic fallback component
  try {
    const rootElement = document.getElementById("root");
    if (rootElement) {
      const root = ReactDOM.createRoot(rootElement);

      const FallbackComponent = () => {
        const [count, setCount] = useState(0);
        return (
          <div style={{ padding: "20px", textAlign: "center" }}>
            <h1>Fallback UI</h1>
            <p>The main application failed to load. This is a simple fallback UI.</p>
            <p>Count: {count}</p>
            <button
              onClick={() => setCount(count + 1)}
              style={{
                padding: "8px 16px",
                backgroundColor: "blue",
                color: "white",
                border: "none",
              }}
            >
              Increment
            </button>
          </div>
        );
      };

      root.render(<FallbackComponent />);
    }
  } catch (fallbackError) {
    console.error("Even fallback rendering failed:", fallbackError);
  }
}
