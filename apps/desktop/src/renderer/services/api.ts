import { ApiResponse } from "../electron.d";
import mockElectronAPI from "../electronApiMock";
import { AgentConfig, FacetData, LogQueryParams } from "../types";

// TESTING ONLY: Set to true to use mock API instead of real Electron API
// Set to false in production or when testing with the real API
const USE_MOCK_API = true;

// Helper function to check if electron API exists and has specific methods
const isElectronAPIAvailable = () => {
  const available = typeof window !== "undefined" && window.electronAPI !== undefined;
  console.log("[API DEBUG] Is electronAPI available:", available);
  if (available) {
    console.log("[API DEBUG] electronAPI methods:", Object.keys(window.electronAPI));
  }
  return available;
};

const isMethodAvailable = (methodName: string) => {
  const electronAvailable = isElectronAPIAvailable();
  let methodAvailable = false;

  if (electronAvailable) {
    methodAvailable =
      typeof window.electronAPI[methodName as keyof typeof window.electronAPI] === "function";
    console.log(`[API DEBUG] Is method '${methodName}' available:`, methodAvailable);
  }

  return electronAvailable && methodAvailable;
};

// Create a wrapper API that will use either the real or mock API
const api = {
  invokeAgent: async (query: string) => {
    if (USE_MOCK_API || !isMethodAvailable("invokeAgent")) {
      console.info("Using mock invokeAgent");
      return mockElectronAPI.invokeAgent(query);
    } else {
      console.info("Using real electronAPI.invokeAgent");
      return window.electronAPI.invokeAgent(query);
    }
  },

  getAgentConfig: async () => {
    if (USE_MOCK_API || !isMethodAvailable("getAgentConfig")) {
      console.info("Using mock getAgentConfig");
      return mockElectronAPI.getAgentConfig();
    } else {
      console.info("Using real electronAPI.getAgentConfig");
      return window.electronAPI.getAgentConfig();
    }
  },

  updateAgentConfig: async (newConfig: Partial<AgentConfig>) => {
    if (USE_MOCK_API || !isMethodAvailable("updateAgentConfig")) {
      console.info("Using mock updateAgentConfig");
      return mockElectronAPI.updateAgentConfig(newConfig);
    } else {
      console.info("Using real electronAPI.updateAgentConfig");
      return window.electronAPI.updateAgentConfig(newConfig);
    }
  },

  fetchLogs: async (params: LogQueryParams) => {
    console.log("[API DEBUG] fetchLogs called with params:", params);
    const shouldUseMock = USE_MOCK_API || !isMethodAvailable("fetchLogs");
    console.log("[API DEBUG] Using mock implementation:", shouldUseMock);

    if (shouldUseMock) {
      console.info("Using mock fetchLogs");
      return mockElectronAPI.fetchLogs(params);
    } else {
      console.info("Using real electronAPI.fetchLogs");
      return window.electronAPI.fetchLogs(params);
    }
  },

  getLogsFacetValues: async (
    start: string,
    end: string
  ): Promise<ApiResponse<FacetData[]> | FacetData[]> => {
    console.log("[API DEBUG] getLogsFacetValues called with:", { start, end });
    const shouldUseMock = USE_MOCK_API || !isMethodAvailable("getLogsFacetValues");
    console.log("[API DEBUG] Using mock implementation:", shouldUseMock);

    if (shouldUseMock) {
      console.info("Using mock getLogsFacetValues");
      try {
        const response = await mockElectronAPI.getLogsFacetValues(start, end);
        console.log("[API DEBUG] Mock response:", response);
        return response;
      } catch (error) {
        console.error("Error in getLogsFacetValues:", error);
        return []; // Return empty array on error
      }
    } else {
      try {
        console.info("Using real electronAPI.getLogsFacetValues");
        const response = await window.electronAPI.getLogsFacetValues(start, end);
        console.log("[API DEBUG] Real API response:", response);
        return response;
      } catch (error) {
        console.error("Error in getLogsFacetValues:", error);
        return []; // Return empty array on error
      }
    }
  },
};

export default api;
