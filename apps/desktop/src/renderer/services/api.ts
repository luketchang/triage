import { ApiResponse } from "../electron.d";
import mockElectronAPI from "../electronApiMock";
import {
  AgentConfig,
  ChatResponse,
  ContextItem,
  FacetData,
  LogQueryParams,
  LogSearchInputCore,
  LogsWithPagination,
  TraceQueryParams,
} from "../types";

// Get mock API setting from environment
const USE_MOCK_API = window.env.USE_MOCK_API;

// Helper function to create an error response
const createErrorResponse = (errorMessage: string): ChatResponse => ({
  success: false,
  content: errorMessage,
  logContext: new Map(),
  codeContext: new Map(),
  logPostprocessing: null,
  codePostprocessing: null,
});

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
  invokeAgent: async (
    query: string,
    logContext: Map<LogSearchInputCore, LogsWithPagination | string> | null = null,
    options?: { reasonOnly?: boolean }
  ) => {
    if (USE_MOCK_API || !isMethodAvailable("invokeAgent")) {
      console.info(
        "Using mock invokeAgent",
        logContext ? "with logContext" : "without logContext",
        options
      );
      return mockElectronAPI.invokeAgent(query, logContext, options);
    } else {
      console.info(
        "Using real electronAPI.invokeAgent",
        logContext ? "with logContext" : "without logContext",
        options
      );

      return window.electronAPI.invokeAgent(query, logContext, options);
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

  agentChat: async (message: string, contextItems: ContextItem[]): Promise<ChatResponse> => {
    // For now, we'll use the invokeAgent method and adapt the response
    console.info("Using agentChat with context items:", contextItems.length);

    // Aggregate logContext from contextItems
    const logContext: Map<LogSearchInputCore, LogsWithPagination | string> = new Map();

    // Iterate through contextItems to extract log context
    contextItems.forEach((item) => {
      if (item.type === "logSearch") {
        // Extract the input and results from LogSearchPair
        const { input, results } = item.data;
        // Add to the map
        logContext.set(input, results);
      }
    });

    try {
      // Invoke the agent with the user's query and logContext
      const agentResponse = await api.invokeAgent(message, logContext.size > 0 ? logContext : null);

      if (!agentResponse.success || !agentResponse.data) {
        return createErrorResponse("Failed to process your request");
      }

      // Extract data from the response
      const data = agentResponse.data;

      // Get the content from the response (preferring content field if available)
      const content = data.content || data.chatHistory?.join("\n\n") || "I processed your request.";

      return {
        success: true,
        content,
        logContext: data.logContext || new Map<LogSearchInputCore, LogsWithPagination | string>(),
        codeContext: data.codeContext || new Map<string, string>(),
        logPostprocessing: data.logPostprocessing,
        codePostprocessing: data.codePostprocessing,
      };
    } catch (error) {
      console.error("Error in agentChat:", error);
      return createErrorResponse("An error occurred while processing your request");
    }
  },

  manualChat: async (message: string, contextItems: ContextItem[]): Promise<ChatResponse> => {
    // For manual mode, we use the invokeAgent with reasonOnly flag
    console.info("Using manualChat with context items:", contextItems.length);

    // Aggregate logContext from contextItems
    const logContext: Map<LogSearchInputCore, LogsWithPagination | string> = new Map();

    // Iterate through contextItems to extract log context
    contextItems.forEach((item) => {
      if (item.type === "logSearch") {
        // Extract the input and results from LogSearchPair
        const { input, results } = item.data;
        // Add to the map
        logContext.set(input, results);
      }
    });

    try {
      // Invoke the agent with the user's query, logContext, and reasonOnly flag
      const agentResponse = await api.invokeAgent(
        message,
        logContext.size > 0 ? logContext : null,
        { reasonOnly: true }
      );

      if (!agentResponse.success || !agentResponse.data) {
        return createErrorResponse("Failed to process your request");
      }

      // Extract data from the response
      const data = agentResponse.data;

      // Get the content from the response (preferring content field if available)
      const content = data.content || data.chatHistory?.join("\n\n") || "I processed your request.";

      return {
        success: true,
        content,
        logContext: (data.logContext || new Map()) as Map<
          LogSearchInputCore,
          LogsWithPagination | string
        >,
        codeContext: (data.codeContext || new Map()) as Map<string, string>,
        logPostprocessing: data.logPostprocessing,
        codePostprocessing: data.codePostprocessing,
      };
    } catch (error) {
      console.error("Error in manualChat:", error);
      return createErrorResponse("An error occurred while processing your request");
    }
  },
};

export default api;
