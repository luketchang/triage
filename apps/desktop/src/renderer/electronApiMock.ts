import { ApiResponse } from "./electron.d";
import { AgentConfig, FacetData, Log, LogQueryParams, LogsWithPagination } from "./types";

import { LogSearchInputCore, PostprocessedLogSearchInput } from "@triage/agent";

/**
 * Mock implementation of the Electron API for local development and testing
 * This can be easily imported in your App.tsx to override the window.electronAPI
 * during development, and removed when you're done testing.
 */

// Create a sample log entry
const createLogEntry = (
  timestamp: string,
  message: string,
  service: string,
  level: string,
  metadata: Record<string, string> = {}
) => ({
  timestamp,
  message,
  service,
  level,
  metadata,
});

// Create sample logs with varying timestamps
const createSampleLogs = (count: number, baseService: string): any[] => {
  const now = new Date("2025-04-09T20:22:25");
  const logs = [];

  for (let i = 0; i < count; i++) {
    // Create timestamps going back from now
    const logTime = new Date(now.getTime() - i * (i % 2 === 0 ? 60000 : 120000)); // Vary times

    // Alternate log levels
    const level = i < 5 ? "error" : "info";

    // Create different messages based on service
    let message = "";
    if (level === "error") {
      message = `Sample error message #${i + 1} for ${baseService}`;
    } else {
      message = `Sample info message #${i + 2} for ${baseService}`;
    }

    logs.push(
      createLogEntry(logTime.toISOString(), message, baseService, level, {
        requestId: `req-${1000 + i}`,
        userId: `user-${2000 + i}`,
        environment: "development",
        duration: `${100 + i * 10}ms`,
      })
    );
  }

  return logs;
};

// Create mock facet data for logs
const createMockFacets = () => {
  return [
    {
      name: "service",
      values: ["orders", "payments", "auth", "tickets", "expiration"],
      counts: [1, 1, 1, 1, 1],
    },
    {
      name: "status",
      values: ["info", "warn", "error"],
      counts: [1, 1, 1],
    },
  ];
};

// Create mock data
const createMockData = () => {
  // Create sample log context
  const logContext = new Map<PostprocessedLogSearchInput, LogsWithPagination | string>();

  // Sample error query
  const errorQuery: PostprocessedLogSearchInput = {
    query: "service:(tickets OR orders OR expiration)",
    start: "2023-10-01T00:00:00Z",
    end: new Date().toISOString(),
    limit: 10,
    title: "Duplicate ticket errors",
    summary: "Looking for duplicate ticket errors",
    pageCursor: null,
  };

  logContext.set(errorQuery, {
    logs: createSampleLogs(5, "auth-service") as any[],
  });

  // Sample performance query
  const perfQuery: PostprocessedLogSearchInput = {
    query: "service:mongo",
    start: "2023-10-01T00:00:00Z",
    end: new Date().toISOString(),
    limit: 10,
    title: "Mongo performance issues",
    summary: "Slow MongoDB queries",
    pageCursor: null,
  };

  logContext.set(perfQuery, {
    logs: createSampleLogs(8, "db-service") as any[],
  });

  // Create sample code context
  const codeContext = new Map<string, string>();

  // Sample code snippet
  codeContext.set(
    "src/services/auth.js",
    `// Authentication Service
const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Authenticates a user and returns a JWT token
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<string>} JWT token
 */
async function login(email, password) {
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new Error('User not found');
    }
    const isValid = await user.validatePassword(password);
    if (!isValid) {
      throw new Error('Invalid password');
    }
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });
    return token;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}`
  );

  return { logContext, codeContext };
};

/**
 * Mock implementation of the Electron API
 */
const mockElectronAPI = {
  /**
   * Invoke the agent with a query and return a mock response
   */
  invokeAgent: async (
    query: string,
    logContext: Map<
      PostprocessedLogSearchInput | LogSearchInputCore,
      LogsWithPagination | string
    > | null,
    options?: { reasonOnly?: boolean }
  ) => {
    console.info(
      "MOCK API: invokeAgent called with:",
      query,
      logContext ? "with logContext" : "without logContext",
      options
    );

    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create sample log context for artifacts if not using reasonOnly mode
    // If logContext is provided, use it, otherwise create mock data
    const mockData = logContext ? { logContext, codeContext: new Map() } : createMockData();

    return {
      success: true,
      message: "Agent invoked successfully",
      data: {
        chatHistory: [
          `You asked: "${query}"`,
          options?.reasonOnly
            ? "I analyzed this using Manual mode (reasoning only)"
            : "I searched logs and analyzed this in Search mode",
          "Here's what I found: This is a simulated response from the agent.",
        ],
        rca: "Root cause identified: This is a mock response.",
        logPostprocessing: mockData.logContext,
        codePostprocessing: mockData.codeContext,
      },
    };
  },

  /**
   * Get the current agent configuration
   */
  getAgentConfig: async (): Promise<AgentConfig> => {
    console.info("Mock getAgentConfig called");

    return {
      repoPath: "/path/to/repo",
      codebaseOverviewPath: "/path/to/overview.md",
      observabilityPlatform: "datadog",
      observabilityFeatures: ["logs", "traces"],
      startDate: new Date("2023-10-01T00:00:00Z"),
      endDate: new Date(),
    };
  },

  /**
   * Update the agent configuration
   */
  updateAgentConfig: async (newConfig: Partial<AgentConfig>): Promise<AgentConfig> => {
    console.info("Mock updateAgentConfig called with:", newConfig);

    const currentConfig = await mockElectronAPI.getAgentConfig();
    return {
      ...currentConfig,
      ...newConfig,
    };
  },

  /**
   * Fetch logs based on query parameters
   */
  fetchLogs: async (
    params: LogQueryParams
  ): Promise<
    ApiResponse<{
      logs: Log[];
      pageCursorOrIndicator?: string;
    }>
  > => {
    console.info("Mock fetchLogs called with:", params);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Generate specific logs that match the second image
    const allLogs = [
      createLogEntry(
        new Date("2025-04-09T20:22:25").toISOString(),
        "Sample error message #1 for orders",
        "orders",
        "error"
      ),
      createLogEntry(
        new Date("2025-04-09T20:22:25").toISOString(),
        "Sample error message #1 for payments",
        "payments",
        "error"
      ),
      createLogEntry(
        new Date("2025-04-09T20:22:25").toISOString(),
        "Sample error message #1 for auth",
        "auth",
        "error"
      ),
      createLogEntry(
        new Date("2025-04-09T20:22:25").toISOString(),
        "Sample error message #1 for api-gateway",
        "api-gateway",
        "error"
      ),
      createLogEntry(
        new Date("2025-04-09T20:22:25").toISOString(),
        "Sample error message #1 for user-service",
        "user-service",
        "error"
      ),
      createLogEntry(
        new Date("2025-04-09T20:21:25").toISOString(),
        "Sample info message #2 for orders",
        "orders",
        "info"
      ),
      createLogEntry(
        new Date("2025-04-09T20:21:25").toISOString(),
        "Sample info message #2 for payments",
        "payments",
        "info"
      ),
      createLogEntry(
        new Date("2025-04-09T20:21:25").toISOString(),
        "Sample info message #2 for auth",
        "auth",
        "info"
      ),
      createLogEntry(
        new Date("2025-04-09T20:21:25").toISOString(),
        "Sample info message #2 for api-gateway",
        "api-gateway",
        "info"
      ),
      createLogEntry(
        new Date("2025-04-09T20:21:25").toISOString(),
        "Sample info message #2 for user-service",
        "user-service",
        "info"
      ),
    ];

    // Apply search filter if present
    let filteredLogs = [...allLogs];
    if (params.query && params.query.length > 0) {
      const searchTerms = params.query.toLowerCase().split(" ");
      filteredLogs = allLogs.filter((log) => {
        return searchTerms.some(
          (term) =>
            log.message.toLowerCase().includes(term) ||
            log.service.toLowerCase().includes(term) ||
            log.level.toLowerCase().includes(term)
        );
      });
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    const paginatedLogs = filteredLogs.slice(0, params.limit);

    return {
      success: true,
      data: {
        logs: paginatedLogs,
        pageCursorOrIndicator:
          filteredLogs.length > params.limit ? `cursor-${Date.now()}` : undefined,
      },
    };
  },

  /**
   * Get facet values for logs
   * Note: This already returns FacetData[] format which matches the expected
   * format after Map<string, string[]> is converted in the main process
   */
  getLogsFacetValues: async (start: string, end: string): Promise<ApiResponse<FacetData[]>> => {
    console.info("Mock getLogsFacetValues called with:", { start, end });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Always return mock facet data with success: true
    return {
      success: true,
      data: createMockFacets(),
    };
  },
};

export default mockElectronAPI;
