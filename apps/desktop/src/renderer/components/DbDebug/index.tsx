import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { UserMessage } from "../../types";

interface DbStats {
  dbPath: string;
  chatsCount: number;
  userMessagesCount: number;
  assistantMessagesCount: number;
  error?: string;
}

const DbDebug: React.FC = () => {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiMethodStatus, setApiMethodStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Check if methods are available in a type-safe way
    const checkMethods = async () => {
      // List of methods to check
      const methodsToCheck = [
        "saveUserMessage",
        "saveAssistantMessage",
        "loadChatMessages",
        "clearChat",
        "getDatabaseStats",
        "invokeAgent",
        "getAgentConfig",
      ];

      const status: Record<string, boolean> = {};

      // Check each method
      for (const method of methodsToCheck) {
        try {
          // Use a helper function to check if a method exists on the api object
          status[method] = typeof (api as any)[method] === "function";
        } catch (error) {
          status[method] = false;
        }
      }

      setApiMethodStatus(status);
    };

    checkMethods();
  }, []);

  const checkDatabase = async () => {
    setLoading(true);
    try {
      const dbStats = await api.getDatabaseStats();
      setStats(dbStats);
      console.info("Database stats:", dbStats);
    } catch (error) {
      console.error("Error checking database:", error);
      setStats({
        dbPath: "Error",
        chatsCount: -1,
        userMessagesCount: -1,
        assistantMessagesCount: -1,
        error: String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  // Try calling save messages through api
  const testSaveMessages = async () => {
    try {
      console.log("Testing message saving through API layer");

      // Create properly typed test message
      const testUserMsg: UserMessage = {
        id: "test-" + Date.now(),
        role: "user",
        timestamp: new Date(),
        content: "Test message from DbDebug component",
      };

      // Save the message using the API wrapper
      const result = await api.saveUserMessage(testUserMsg);
      console.log("Save message result:", result);

      // Refresh stats after save
      await checkDatabase();
    } catch (e) {
      console.error("Error in test save:", e);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "10px",
        right: "10px",
        background: "#f5f5f5",
        padding: "10px",
        borderRadius: "5px",
        border: "1px solid #ddd",
        zIndex: 1000,
        fontFamily: "monospace",
        fontSize: "12px",
        maxWidth: "400px",
        maxHeight: "400px",
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", gap: "5px", marginBottom: "8px" }}>
        <button
          onClick={checkDatabase}
          style={{
            padding: "5px 10px",
            background: "#0066cc",
            color: "white",
            border: "none",
            borderRadius: "3px",
            cursor: "pointer",
          }}
        >
          {loading ? "Loading..." : "Check Database Stats"}
        </button>

        <button
          onClick={testSaveMessages}
          style={{
            padding: "5px 10px",
            background: "#009900",
            color: "white",
            border: "none",
            borderRadius: "3px",
            cursor: "pointer",
          }}
        >
          Test Save Message
        </button>
      </div>

      {stats && (
        <div>
          <div>
            <strong>DB Path:</strong> {stats.dbPath}
          </div>
          <div>
            <strong>Chats:</strong> {stats.chatsCount}
          </div>
          <div>
            <strong>User Messages:</strong> {stats.userMessagesCount}
          </div>
          <div>
            <strong>Assistant Messages:</strong> {stats.assistantMessagesCount}
          </div>
          {stats.error && (
            <div style={{ color: "red" }}>
              <strong>Error:</strong> {stats.error}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: "10px", borderTop: "1px solid #ddd", paddingTop: "10px" }}>
        <strong>API Method Availability:</strong>
        <div style={{ maxHeight: "150px", overflow: "auto", marginTop: "5px" }}>
          {Object.entries(apiMethodStatus).map(([method, available]) => (
            <div key={method} style={{ color: available ? "green" : "red" }}>
              {method}: {available ? "Available" : "Not Available"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DbDebug;
