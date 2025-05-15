import { AppConfig } from "src/common/AppConfig.js";
import {
  AgentAssistantMessage,
  AgentChatMessage,
  Chat,
  CodebaseOverview,
  FacetData,
  Log,
  LogQueryParams,
  LogsWithPagination,
  TraceQueryParams,
  TracesWithPagination,
} from "./types/index.js";

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
): Log => ({
  timestamp,
  message,
  service,
  level,
  metadata,
});

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

// Create mock facet data for spans
const createMockSpanFacets = () => {
  return [
    {
      name: "service",
      values: ["orders", "payments", "auth", "tickets", "expiration"],
      counts: [1, 1, 1, 1, 1],
    },
    {
      name: "resource",
      values: ["/api/checkout", "/api/payment", "/api/auth", "/api/orders"],
      counts: [1, 1, 1, 1],
    },
    {
      name: "http.status_code",
      values: ["200", "201", "400", "404", "500"],
      counts: [5, 3, 2, 1, 1],
    },
    {
      name: "environment",
      values: ["production", "staging", "development"],
      counts: [3, 2, 1],
    },
  ];
};

// Create sample trace with spans
const createSampleTrace = (
  traceId: string,
  rootService: string,
  rootResource: string,
  hasError: boolean = false
) => {
  const startTime = new Date();
  const duration = 500 + Math.random() * 1000; // Random duration between 500-1500ms

  // Create breakdown of service latencies
  const services = ["orders", "payments", "auth", "database", "cache"];
  const serviceBreakdown = services.map((service, _index) => {
    const serviceDuration = (duration / services.length) * (1 + Math.random() * 0.5);
    return {
      service,
      duration: serviceDuration,
      percentage: (serviceDuration / duration) * 100,
    };
  });

  // Create a root span and some child spans
  const rootSpan = {
    id: `span-${traceId}-1`,
    service: rootService,
    operation: "http.request",
    resource: rootResource,
    start: startTime,
    end: new Date(startTime.getTime() + duration),
    duration: duration,
    level: 0,
    error: hasError
      ? {
          message: "Internal server error",
          type: "Error",
          stack:
            "Error: Internal server error\n    at processRequest (/app/src/server.js:42:12)\n    at handleRequest (/app/src/routes.js:21:5)",
        }
      : undefined,
    tags: {
      "http.method": "POST",
      "http.url": rootResource,
      "http.status_code": hasError ? "500" : "200",
    } as Record<string, string>,
    children: [
      {
        id: `span-${traceId}-2`,
        service: "auth",
        operation: "validate.token",
        resource: "/auth/validate",
        start: new Date(startTime.getTime() + 10),
        end: new Date(startTime.getTime() + 50),
        duration: 40,
        level: 1,
        error: undefined,
        tags: {
          "user.id": "user-123",
        } as Record<string, string>,
        children: [],
      },
      {
        id: `span-${traceId}-3`,
        service: "database",
        operation: "db.query",
        resource: "SELECT * FROM orders",
        start: new Date(startTime.getTime() + 60),
        end: new Date(startTime.getTime() + 200),
        duration: 140,
        level: 1,
        error: undefined,
        tags: {
          "db.type": "postgres",
          "db.rows": "42",
        } as Record<string, string>,
        children: [],
      },
    ],
  };

  // Add the child spans connection to database for some traces
  if (Math.random() > 0.5) {
    rootSpan.children.push({
      id: `span-${traceId}-4`,
      service: "cache",
      operation: "redis.get",
      resource: "HGET user:profile",
      start: new Date(startTime.getTime() + 210),
      end: new Date(startTime.getTime() + 230),
      duration: 20,
      level: 1,
      error: undefined,
      tags: {
        "cache.hit": "true",
      } as Record<string, string>,
      children: [],
    });
  }

  return {
    traceId: traceId,
    rootService: rootService,
    rootResource: rootResource,
    rootOperation: "http.request",
    startTime: startTime,
    endTime: new Date(startTime.getTime() + duration),
    duration: duration,
    httpStatus: hasError ? "500" : "200",
    hasError: hasError,
    serviceBreakdown: serviceBreakdown,
    displayTrace: {
      traceId: traceId,
      rootSpan: rootSpan,
      spans: [rootSpan, ...rootSpan.children],
      startTime: startTime,
      endTime: new Date(startTime.getTime() + duration),
      totalDuration: duration,
    },
  };
};

// Create sample chats for mock API
const mockChats: Chat[] = [
  { id: 1, createdAt: new Date(Date.now() - 86400000 * 3) },
  { id: 2, createdAt: new Date(Date.now() - 86400000 * 2) },
  { id: 3, createdAt: new Date(Date.now() - 86400000) },
];

/**
 * Mock implementation of the Electron API
 */
const mockElectronAPI = {
  /**
   * Invoke the agent with a query and return a mock response
   */
  invokeAgent: async (
    _query: string,
    _chatHistory: AgentChatMessage[],
    _metadata: { timezone: string }
  ): Promise<AgentAssistantMessage> => {
    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create a much fuller response content with detailed analysis
    const responseContent = `## Root Cause Analysis
    
I've analyzed the issue and identified several key problems:

1. The authentication service is returning 401 Unauthorized errors intermittently
2. Database connection timeouts are occurring in the payment service
3. The order service is experiencing high latency during checkout

The primary issue appears to be in the authentication middleware where token validation is failing due to an incorrect JWT secret configuration in the production environment. This is causing cascading failures in downstream services.`;

    // Create comprehensive log postprocessing facts for the sidebar
    const logFacts = [
      {
        title: "Authentication Errors",
        fact: "Multiple 401 Unauthorized errors observed in auth service with error message 'Invalid token signature'",
        query: 'level:error service:auth message:"Invalid token signature"',
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        limit: 100,
        pageCursor: null,
        type: "logSearchInput",
      },
      {
        title: "Database Timeouts",
        fact: "Payment service experiencing database connection timeouts with error message 'Connection timeout after 5000ms'",
        query: 'level:error service:payments message:"Connection timeout"',
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        limit: 100,
        pageCursor: null,
        type: "logSearchInput",
      },
      {
        title: "High Latency Events",
        fact: "Order service API endpoints show increased latency with processing times over 5 seconds",
        query: "service:orders latency:>5000",
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        limit: 100,
        pageCursor: null,
        type: "logSearchInput",
      },
      {
        title: "User Impact",
        fact: "Approximately 15% of checkout requests are failing with HTTP 500 errors",
        query: 'service:api-gateway status:500 path:"/api/checkout"',
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        limit: 100,
        pageCursor: null,
        type: "logSearchInput",
      },
    ];

    // Create comprehensive code postprocessing facts for the sidebar
    const codeFacts = [
      {
        title: "Auth Middleware Issue",
        fact: "The authentication middleware is using a hardcoded JWT secret instead of loading from environment variables",
        filepath: "src/services/auth.ts",
        startLine: 1,
        endLine: 10,
      },
      {
        title: "Database Connection Configuration",
        fact: "The database connection pool size is set too low for production traffic and timeout is misconfigured",
        filepath: "src/services/payments/database.ts",
        startLine: 1,
        endLine: 15,
      },
      {
        title: "Order Processing Performance",
        fact: "The order service is not properly caching inventory checks, leading to duplicate database queries",
        filepath: "src/services/orders/service.ts",
        startLine: 1,
        endLine: 8,
      },
    ];

    // Create step objects with the correct type structure
    const logPostprocessingStep = {
      type: "logPostprocessing" as const,
      timestamp: new Date(),
      facts: logFacts,
    };

    const codePostprocessingStep = {
      type: "codePostprocessing" as const,
      timestamp: new Date(),
      facts: codeFacts,
    };

    return {
      role: "assistant",
      response: responseContent,
      steps: [logPostprocessingStep, codePostprocessingStep],
      error: null,
    };
  },

  /**
   * Get the current agent configuration
   */
  getAppConfig: async (): Promise<AppConfig> => {
    console.info("Mock getAppConfig called");

    throw new Error("Not implemented");
  },

  /**
   * Update the application configuration
   */
  updateAppConfig: async (newConfig: Partial<AppConfig>): Promise<AppConfig> => {
    console.info("Mock updateAppConfig called with:", newConfig);

    const currentConfig = await mockElectronAPI.getAppConfig();
    return {
      ...currentConfig,
      ...newConfig,
    };
  },

  /**
   * Fetch logs based on query parameters
   */
  fetchLogs: async (params: LogQueryParams): Promise<LogsWithPagination> => {
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
      createLogEntry(
        new Date("2025-04-09T20:20:25").toISOString(),
        "Sample warning message #3 for orders",
        "orders",
        "warn"
      ),
      createLogEntry(
        new Date("2025-04-09T20:20:25").toISOString(),
        "Sample warning message #3 for payments",
        "payments",
        "warn"
      ),
      createLogEntry(
        new Date("2025-04-09T20:20:25").toISOString(),
        "Sample warning message #3 for auth",
        "auth",
        "warn"
      ),
      createLogEntry(
        new Date("2025-04-09T20:20:25").toISOString(),
        "Sample warning message #3 for api-gateway",
        "api-gateway",
        "warn"
      ),
      createLogEntry(
        new Date("2025-04-09T20:20:25").toISOString(),
        "Sample warning message #3 for user-service",
        "user-service",
        "warn"
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
      logs: paginatedLogs,
      pageCursorOrIndicator:
        filteredLogs.length > params.limit ? `cursor-${Date.now()}` : undefined,
    };
  },

  /**
   * Get facet values for logs
   * Note: This already returns FacetData[] format which matches the expected
   * format after Map<string, string[]> is converted in the main process
   */
  getLogsFacetValues: async (start: string, end: string): Promise<FacetData[]> => {
    console.info("Mock getLogsFacetValues called with:", { start, end });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Always return mock facet data
    return createMockFacets();
  },

  /**
   * Fetch traces based on query parameters
   */
  fetchTraces: async (params: TraceQueryParams): Promise<TracesWithPagination> => {
    console.info("Mock fetchTraces called with:", params);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Create some sample traces
    const allTraces = [
      createSampleTrace("trace-1", "orders", "/api/orders", false),
      createSampleTrace("trace-2", "payments", "/api/payment", true),
      createSampleTrace("trace-3", "auth", "/api/login", false),
      createSampleTrace("trace-4", "tickets", "/api/tickets", false),
      createSampleTrace("trace-5", "expiration", "/api/expiration", true),
      createSampleTrace("trace-6", "orders", "/api/checkout", false),
      createSampleTrace("trace-7", "payments", "/api/refund", false),
      createSampleTrace("trace-8", "auth", "/api/signup", true),
    ];

    // Apply search filter if present
    let filteredTraces = [...allTraces];
    if (params.query && params.query.length > 0) {
      const searchTerms = params.query.toLowerCase().split(" ");
      filteredTraces = allTraces.filter((trace) => {
        return searchTerms.some(
          (term) =>
            trace.rootResource.toLowerCase().includes(term) ||
            trace.rootService.toLowerCase().includes(term) ||
            term.includes(`status:${trace.httpStatus}`)
        );
      });
    }

    // Sort by timestamp (newest first)
    filteredTraces.sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    // Apply limit
    const paginatedTraces = filteredTraces.slice(0, params.limit);

    return {
      traces: paginatedTraces,
      pageCursorOrIndicator:
        filteredTraces.length > params.limit ? `cursor-${Date.now()}` : undefined,
    };
  },

  /**
   * Get facet values for spans
   */
  getSpansFacetValues: async (start: string, end: string): Promise<FacetData[]> => {
    console.info("Mock getSpansFacetValues called with:", { start, end });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Always return mock facet data
    return createMockSpanFacets();
  },

  /**
   * Create a new chat
   */
  createChat: async (): Promise<Chat> => {
    console.info("Mock createChat called");

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Return a mock chat
    const newChat = {
      id: Math.floor(Math.random() * 1000) + 1,
      createdAt: new Date(),
    };

    // Add to mock chats
    mockChats.push(newChat);

    return newChat;
  },

  /**
   * Get all chats
   */
  getAllChats: async (): Promise<Chat[]> => {
    console.info("Mock getAllChats called");

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Return sorted chats (newest first)
    return [...mockChats].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  /**
   * Chat persistence methods
   */
  saveUserMessage: async () => {
    console.info("Mock saveUserMessage - not implemented in mock mode");
    return null;
  },

  saveAssistantMessage: async () => {
    console.info("Mock saveAssistantMessage - not implemented in mock mode");
    return null;
  },

  loadChatMessages: async (chatId?: number) => {
    console.info("Mock loadChatMessages called with chatId:", chatId);
    return [];
  },

  clearChat: async () => {
    console.info("Mock clearChat - not implemented in mock mode");
    return false;
  },

  /**
   * Mock implementation of generating a codebase overview
   */
  generateCodebaseOverview: async (repoPath: string): Promise<CodebaseOverview> => {
    console.info("Mock generateCodebaseOverview called with:", repoPath);

    // Simulate some delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Just return a mock path
    return {
      content: "This is a mock codebase overview",
      repoPath: `${repoPath}/.triage/codebase-overview.md`,
      createdAt: new Date(),
    };
  },

  // Note: onCodebaseOverviewProgress is handled in api.ts with simulation
};

export default mockElectronAPI;
