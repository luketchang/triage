import { ApiResponse } from "./electron.d";
import {
  AgentConfig,
  AgentMessage,
  ContextItem,
  FacetData,
  Log,
  LogQueryParams,
  LogsWithPagination,
  TraceQueryParams,
} from "./types";

import { LogSearchInputCore } from "@triage/agent";

// Define a local version of PostprocessedLogSearchInput to avoid import issues
export interface PostprocessedLogSearchInput {
  query: string;
  start: string;
  end: string;
  limit: number;
  pageCursor: string | null;
  type?: string;
  title?: string;
  reasoning?: string;
  summary?: string;
}

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

// Create sample logs with varying timestamps
const createSampleLogs = (count: number, baseService: string): Log[] => {
  const levels = ["info", "warn", "error", "debug"];
  const logs: Log[] = [];

  for (let i = 0; i < count; i++) {
    logs.push(
      createLogEntry(
        new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
        `Sample ${levels[i % levels.length]} message #${i + 1} for ${baseService}`,
        baseService,
        levels[i % levels.length],
        {
          requestId: `req-${Math.random().toString(36).substring(2, 10)}`,
          userId: `user-${Math.floor(Math.random() * 1000)}`,
        }
      )
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

/**
 * Mock implementation of the Electron API
 */
const mockElectronAPI = {
  /**
   * Invoke the agent with a query and return a mock response
   */
  invokeAgent: async (
    query: string,
    logContext: Map<LogSearchInputCore, LogsWithPagination | string> | null,
    options?: { reasonOnly?: boolean }
  ): Promise<ApiResponse<AgentMessage>> => {
    console.info(
      "MOCK API: invokeAgent called with:",
      query,
      logContext ? "with logContext" : "without logContext",
      options
    );

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
        codeBlock: `export function validateToken(token: string): boolean {
  try {
    // BUG: Hardcoded secret instead of using process.env.JWT_SECRET
    const decoded = jwt.verify(token, 'hardcoded_secret_do_not_use_in_production');
    return true;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
}`,
      },
      {
        title: "Database Connection Configuration",
        fact: "The database connection pool size is set too low for production traffic and timeout is misconfigured",
        filepath: "src/services/payments/database.ts",
        codeBlock: `export const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // BUG: Connection pool size too small and timeout too short
  pool: {
    max: 5,          // Should be higher for production
    min: 0,
    timeout: 5000    // Too short for complex queries
  }
};`,
      },
      {
        title: "Order Processing Performance",
        fact: "The order service is not properly caching inventory checks, leading to duplicate database queries",
        filepath: "src/services/orders/service.ts",
        codeBlock: `async function checkInventory(productId: string): Promise<boolean> {
  // BUG: No caching, causing repeated database calls
  const inventory = await db.query(
    'SELECT quantity FROM inventory WHERE product_id = $1',
    [productId]
  );
  
  return inventory.rows[0]?.quantity > 0;
}`,
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
      success: true,
      data: {
        role: "assistant",
        response: responseContent,
        steps: [logPostprocessingStep, codePostprocessingStep],
        error: null,
      },
    };
  },

  /**
   * Get the current agent configuration
   */
  getAgentConfig: async (): Promise<AgentConfig> => {
    console.info("Mock getAgentConfig called");

    return {
      repoPath: "/Users/luketchang/code/ticketing",
      codebaseOverviewPath: "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md",
      observabilityPlatform: "datadog",
      observabilityFeatures: ["logs"],
      startDate: new Date("2025-04-16T21:00:00Z"),
      endDate: new Date("2025-04-16T23:59:59Z"),
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

  /**
   * Fetch traces based on query parameters
   */
  fetchTraces: async (params: TraceQueryParams) => {
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
      success: true,
      data: {
        traces: paginatedTraces,
        pageCursorOrIndicator:
          filteredTraces.length > params.limit ? `cursor-${Date.now()}` : undefined,
      },
    };
  },

  /**
   * Get facet values for spans
   */
  getSpansFacetValues: async (start: string, end: string): Promise<ApiResponse<FacetData[]>> => {
    console.info("Mock getSpansFacetValues called with:", { start, end });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Always return mock facet data with success: true
    return {
      success: true,
      data: createMockSpanFacets(),
    };
  },

  /**
   * Mock implementation for agent-based chat
   */
  agentChat: async (message: string, contextItems: ContextItem[]) => {
    console.info("Mock agentChat called with message:", message);
    console.info("Context items:", contextItems.length);

    // Create detailed response content
    const detailedContent = `## Analysis of the Issue

Based on the logs and code you've shared, I can see the following issues:

1. The authentication service is failing with 401 errors due to JWT token validation problems
2. There are database connection timeouts occurring in the payment service
3. The order service shows high latency during peak traffic periods

The root cause appears to be a misconfiguration in the authentication middleware where JWT validation is using an incorrect secret key in production. This is causing a cascade of failures in dependent services.

**Recommended fix:** Update the JWT secret configuration in the auth service to use environment variables properly and ensure the same secret is used consistently across services.`;

    // Create comprehensive log postprocessing facts
    const detailedLogFacts = [
      {
        title: "Authentication Failures",
        fact: "JWT token validation errors showing 'Invalid signature' in auth service logs",
        query: 'service:auth level:error message:"Invalid signature"',
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        limit: 100,
        pageCursor: null,
        type: "logSearchInput",
      },
      {
        title: "Payment Service Database Issues",
        fact: "Database connection timeouts occurring in payment service during checkout flow",
        query: 'service:payments level:error message:"Connection timeout"',
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        limit: 100,
        pageCursor: null,
        type: "logSearchInput",
      },
      {
        title: "Order Service Latency",
        fact: "Order service experiencing high latency (>2s) during checkout operations",
        query: 'service:orders duration:>2000 operation:"checkout"',
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        limit: 100,
        pageCursor: null,
        type: "logSearchInput",
      },
      {
        title: "Error Rate Spike",
        fact: "Error rate increased by 25% during the incident period compared to baseline",
        query: "status:error",
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        limit: 100,
        pageCursor: null,
        type: "logSearchInput",
      },
      {
        title: "API Gateway Errors",
        fact: "API Gateway returning 502 Bad Gateway errors when calling auth service",
        query: 'service:api-gateway status:502 path:"/api/auth"',
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        limit: 100,
        pageCursor: null,
        type: "logSearchInput",
      },
    ];

    // Create comprehensive code postprocessing facts
    const detailedCodeFacts = [
      {
        title: "JWT Secret Misconfiguration",
        fact: "Auth middleware using hardcoded JWT secret instead of environment variable",
        filepath: "src/services/auth/middleware/auth.ts",
        codeBlock: `// JWT validation middleware
function validateToken(token) {
  try {
    // ISSUE: Hardcoded secret instead of using environment variable
    const decoded = jwt.verify(token, 'dev_secret_key');
    return { valid: true, user: decoded };
  } catch (err) {
    logger.error('Token validation failed:', err);
    return { valid: false, error: err.message };
  }
}`,
      },
      {
        title: "Database Connection Pool",
        fact: "Payment service has insufficient database connection pool configuration",
        filepath: "src/services/payments/config/database.ts",
        codeBlock: `// Database configuration
module.exports = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'payments',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  // ISSUE: Connection pool too small for production traffic
  pool: {
    max: 5,
    min: 0,
    idle: 10000,
    acquire: 30000,
    evict: 1000
  }
};`,
      },
      {
        title: "Missing Query Optimization",
        fact: "Order service making inefficient database queries during checkout",
        filepath: "src/services/orders/repositories/order.repository.ts",
        codeBlock: `// Get order details with items
async function getOrderWithItems(orderId) {
  // ISSUE: N+1 query problem - fetching items individually
  const order = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  
  // This should use a JOIN instead of separate queries
  const items = await Promise.all(
    order.items.map(item => db.query('SELECT * FROM order_items WHERE id = $1', [item.id]))
  );
  
  return { ...order, items };
}`,
      },
      {
        title: "Environment Configuration",
        fact: "Production environment configuration missing crucial settings",
        filepath: "config/production.env",
        codeBlock: `# Production environment settings
NODE_ENV=production
PORT=3000
API_URL=https://api.example.com

# ISSUE: JWT_SECRET is missing from production config
# JWT_SECRET should be defined here

DB_HOST=production-db.example.com
DB_PORT=5432
DB_NAME=ticketing
DB_USER=app
# DB_PASSWORD is loaded from secrets manager`,
      },
    ];

    // Create mock log and code context maps
    const mockLogContext = new Map<LogSearchInputCore, LogsWithPagination | string>();
    const mockCodeContext = new Map<string, string>();

    // Add sample items to the context maps
    mockLogContext.set(
      {
        query: 'service:auth level:error message:"Invalid signature"',
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        limit: 100,
        pageCursor: null,
        type: "logSearchInput",
      },
      {
        logs: createSampleLogs(5, "auth-service"),
      }
    );

    mockCodeContext.set(
      "src/services/auth/middleware/auth.ts",
      `// Authentication middleware
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ error: 'Authentication required' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Problematic code: hardcoded secret
    const payload = jwt.verify(token, 'dev_secret_key');
    req.currentUser = payload;
    next();
  } catch (err) {
    logger.error('Token validation failed:', err);
    return res.status(401).send({ error: 'Invalid authentication token' });
  }
}`
    );

    return {
      success: true,
      content: detailedContent,
      logContext: mockLogContext,
      codeContext: mockCodeContext,
      logPostprocessing: {
        facts: detailedLogFacts,
      },
      codePostprocessing: {
        facts: detailedCodeFacts,
      },
    };
  },
};

export default mockElectronAPI;
