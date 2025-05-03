import { ApiResponse } from "../electron.d";
import mockElectronAPI from "../electronApiMock";
import {
  AgentAssistantMessage,
  AgentChatMessage,
  AgentConfig,
  AgentStreamUpdate,
  FacetData,
  LogQueryParams,
  TraceQueryParams,
} from "../types";

// Get mock API setting from environment
const USE_MOCK_API = window.env.USE_MOCK_API;

// Helper function to check if electron API exists and has specific methods
const isElectronAPIAvailable = () => {
  const available = typeof window !== "undefined" && window.electronAPI !== undefined;
  console.info("[API DEBUG] Is electronAPI available:", available);
  if (available) {
    console.info("[API DEBUG] electronAPI methods:", Object.keys(window.electronAPI));
  }
  return available;
};

const isMethodAvailable = (methodName: string) => {
  const electronAvailable = isElectronAPIAvailable();
  let methodAvailable = false;

  if (electronAvailable) {
    methodAvailable =
      typeof window.electronAPI[methodName as keyof typeof window.electronAPI] === "function";
    console.info(`[API DEBUG] Is method '${methodName}' available:`, methodAvailable);
  }

  return electronAvailable && methodAvailable;
};

// Create a wrapper API that will use either the real or mock API
const api = {
  // Register for agent updates
  onAgentUpdate: (callback: (update: AgentStreamUpdate) => void) => {
    if (USE_MOCK_API || !isMethodAvailable("onAgentUpdate")) {
      console.info("Mock onAgentUpdate - no streaming available in mock mode");
      return () => {}; // Return no-op cleanup function
    } else {
      console.info("Using real electronAPI.onAgentUpdate");
      return window.electronAPI.onAgentUpdate(callback);
    }
  },

  invokeAgent: async (
    query: string,
    chatHistory: AgentChatMessage[],
    options?: { reasonOnly?: boolean }
  ): Promise<AgentAssistantMessage> => {
    if (USE_MOCK_API || !isMethodAvailable("invokeAgent")) {
      return mockElectronAPI.invokeAgent(query, chatHistory, options);
    } else {
      return window.electronAPI.invokeAgent(query, chatHistory, options);
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
    console.info("[API DEBUG] fetchLogs called with params:", params);
    const shouldUseMock = USE_MOCK_API || !isMethodAvailable("fetchLogs");
    console.info("[API DEBUG] Using mock implementation:", shouldUseMock);

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
    console.info("[API DEBUG] getLogsFacetValues called with:", { start, end });
    const shouldUseMock = USE_MOCK_API || !isMethodAvailable("getLogsFacetValues");
    console.info("[API DEBUG] Using mock implementation:", shouldUseMock);

    if (shouldUseMock) {
      console.info("Using mock getLogsFacetValues");
      try {
        const response = await mockElectronAPI.getLogsFacetValues(start, end);
        console.info("[API DEBUG] Mock response:", response);
        return response;
      } catch (error) {
        console.error("Error in getLogsFacetValues:", error);
        return []; // Return empty array on error
      }
    } else {
      try {
        console.info("Using real electronAPI.getLogsFacetValues");
        const response = await window.electronAPI.getLogsFacetValues(start, end);
        console.info("[API DEBUG] Real API response:", response);
        return response;
      } catch (error) {
        console.error("Error in getLogsFacetValues:", error);
        return []; // Return empty array on error
      }
    }
  },

  fetchTraces: async (params: TraceQueryParams) => {
    console.info("[API DEBUG] fetchTraces called with params:", params);
    const shouldUseMock = USE_MOCK_API || !isMethodAvailable("fetchTraces");
    console.info("[API DEBUG] Using mock implementation:", shouldUseMock);

    if (shouldUseMock) {
      console.info("Using mock fetchTraces");
      return mockElectronAPI.fetchTraces(params);
    } else {
      console.info("Using real electronAPI.fetchTraces");
      return window.electronAPI.fetchTraces(params);
    }
  },

  getSpansFacetValues: async (
    start: string,
    end: string
  ): Promise<ApiResponse<FacetData[]> | FacetData[]> => {
    console.info("[API DEBUG] getSpansFacetValues called with:", { start, end });
    const shouldUseMock = USE_MOCK_API || !isMethodAvailable("getSpansFacetValues");
    console.info("[API DEBUG] Using mock implementation:", shouldUseMock);

    if (shouldUseMock) {
      console.info("Using mock getSpansFacetValues");
      try {
        const response = await mockElectronAPI.getSpansFacetValues(start, end);
        console.info("[API DEBUG] Mock response:", response);
        return response;
      } catch (error) {
        console.error("Error in getSpansFacetValues:", error);
        return []; // Return empty array on error
      }
    } else {
      try {
        console.info("Using real electronAPI.getSpansFacetValues");
        const response = await window.electronAPI.getSpansFacetValues(start, end);
        console.info("[API DEBUG] Real API response:", response);
        return response;
      } catch (error) {
        console.error("Error in getSpansFacetValues:", error);
        return []; // Return empty array on error
      }
    }
  },
};

export default api;
