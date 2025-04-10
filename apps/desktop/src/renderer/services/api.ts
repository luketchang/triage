import mockElectronAPI from "../electronApiMock";
import { AgentConfig, LogQueryParams } from "../types";

// TESTING ONLY: Set to true to use mock API instead of real Electron API
// Set to false in production or when testing with the real API
const USE_MOCK_API = true;

// Create a wrapper API that will use either the real or mock API
const api = {
  invokeAgent: async (query: string) => {
    if (USE_MOCK_API) {
      console.info("Using mock invokeAgent");
      return mockElectronAPI.invokeAgent(query);
    } else {
      return window.electronAPI.invokeAgent(query);
    }
  },

  getAgentConfig: async () => {
    if (USE_MOCK_API) {
      console.info("Using mock getAgentConfig");
      return mockElectronAPI.getAgentConfig();
    } else {
      return window.electronAPI.getAgentConfig();
    }
  },

  updateAgentConfig: async (newConfig: Partial<AgentConfig>) => {
    if (USE_MOCK_API) {
      console.info("Using mock updateAgentConfig");
      return mockElectronAPI.updateAgentConfig(newConfig);
    } else {
      return window.electronAPI.updateAgentConfig(newConfig);
    }
  },

  fetchLogs: async (params: LogQueryParams) => {
    // In a real implementation, this would call the actual observability API
    if (USE_MOCK_API) {
      console.info("Using mock fetchLogs");
      return mockElectronAPI.fetchLogs(params);
    } else {
      // This would be implemented in the actual electron API
      // For now, we'll return mock data
      return mockElectronAPI.fetchLogs(params);
    }
  },

  getLogsFacetValues: async (start: string, end: string) => {
    if (USE_MOCK_API) {
      console.info("Using mock getLogsFacetValues");
      try {
        const response = await mockElectronAPI.getLogsFacetValues(start, end);
        // Ensure we always return an array
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error("Error in getLogsFacetValues:", error);
        return []; // Return empty array on error
      }
    } else {
      try {
        // This would be implemented in the actual electron API
        // For now, we'll return mock data
        const response = await mockElectronAPI.getLogsFacetValues(start, end);
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error("Error in getLogsFacetValues:", error);
        return []; // Return empty array on error
      }
    }
  },
};

export default api;
