import React, { useEffect, useState } from "react";

// Define types for our component state
interface AppState {
  repoPath: string;
  issue: string;
  status: "idle" | "loading" | "success" | "error";
  statusMessage: string;
  chatHistory: string[];
  rootCauseAnalysis: string | null;
  errorMessage: string | null;
}

// Define the type for the window.api global
declare global {
  interface Window {
    api: {
      invokeAgent: (
        issue: string,
        repoPath: string
      ) => Promise<{
        success: boolean;
        chatHistory?: string[];
        rootCauseAnalysis?: string | null;
        error?: string;
      }>;
      getCurrentDirectory: () => string;
    };
  }
}

const App: React.FC = () => {
  // Component state
  const [state, setState] = useState<AppState>({
    repoPath: "",
    issue: "",
    status: "idle",
    statusMessage: "Ready",
    chatHistory: [],
    rootCauseAnalysis: null,
    errorMessage: null,
  });

  // Set default repository path on component mount
  useEffect(() => {
    // Try to get the current directory from the exposed API
    if (window.api) {
      try {
        const currentDir = window.api.getCurrentDirectory();
        setState((prev: AppState) => ({
          ...prev,
          repoPath: currentDir || "",
        }));
      } catch (error) {
        console.error("Error getting current directory:", error);
      }
    }
  }, []);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setState((prev: AppState) => ({
      ...prev,
      [id]: value,
    }));
  };

  // Handle the invoke button click
  const handleInvoke = async () => {
    // Validate inputs
    if (!state.repoPath) {
      alert("Please enter a repository path");
      return;
    }

    if (!state.issue) {
      alert("Please describe the issue");
      return;
    }

    try {
      // Update status to loading
      setState((prev: AppState) => ({
        ...prev,
        status: "loading",
        statusMessage: "Processing...",
        chatHistory: [],
        rootCauseAnalysis: null,
        errorMessage: null,
      }));

      // Call the agent using the exposed API
      const result = await window.api.invokeAgent(state.issue, state.repoPath);

      // Handle the response
      if (result.success) {
        setState((prev: AppState) => ({
          ...prev,
          status: "success",
          statusMessage: "Completed successfully",
          chatHistory: result.chatHistory || [],
          rootCauseAnalysis: result.rootCauseAnalysis || null,
        }));
      } else {
        setState((prev: AppState) => ({
          ...prev,
          status: "error",
          statusMessage: "Error occurred",
          errorMessage: result.error || "Unknown error",
        }));
      }
    } catch (error) {
      // Handle any unexpected errors
      setState((prev: AppState) => ({
        ...prev,
        status: "error",
        statusMessage: "Error occurred",
        errorMessage: error instanceof Error ? error.message : String(error),
      }));
      console.error("Error invoking agent:", error);
    }
  };

  // Format chat history for display
  const ChatHistory: React.FC = () => {
    if (state.chatHistory.length === 0) {
      return <p>No chat history available.</p>;
    }

    return (
      <div className="chat-history">
        {state.chatHistory.map((message: string, index: number) => (
          <div className="message" key={index}>
            <div className="message-header">Message {index + 1}</div>
            <div
              className="message-content"
              dangerouslySetInnerHTML={{ __html: message.replace(/\n/g, "<br>") }}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container">
      <header>
        <h1>Triage Agent</h1>
        <p>An AI-powered tool for debugging and triaging issues</p>
      </header>

      <main>
        <div className="form-container">
          <div className="form-group">
            <label htmlFor="repoPath">Repository Path:</label>
            <input
              type="text"
              id="repoPath"
              value={state.repoPath}
              onChange={handleInputChange}
              placeholder="/path/to/your/repository"
              disabled={state.status === "loading"}
            />
          </div>

          <div className="form-group">
            <label htmlFor="issue">Describe the Issue:</label>
            <textarea
              id="issue"
              rows={5}
              value={state.issue}
              onChange={handleInputChange}
              placeholder="Describe the issue you're experiencing..."
              disabled={state.status === "loading"}
            />
          </div>

          <button
            className="primary-button"
            onClick={handleInvoke}
            disabled={state.status === "loading"}
          >
            Invoke Agent
          </button>
        </div>

        <div className="results-container">
          <div className="status-indicator">
            <div className={`indicator ${state.status}`} />
            <span>{state.statusMessage}</span>
          </div>

          <div className="output-section">
            <h2>Analysis Results</h2>
            <div className="output">
              {state.errorMessage ? (
                <div className="error-message">Error: {state.errorMessage}</div>
              ) : (
                <>
                  <h3>Analysis Steps</h3>
                  <ChatHistory />

                  {state.rootCauseAnalysis && (
                    <>
                      <h3>Root Cause Analysis</h3>
                      <div className="rca">{state.rootCauseAnalysis}</div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
