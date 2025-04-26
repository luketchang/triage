import { ApiResponse } from "./electron.d";
import {
  AgentConfig,
  FacetData,
  FileTreeNode,
  Log,
  LogQueryParams,
  LogsWithPagination,
  TraceQueryParams,
} from "./types";

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

    // Determine log level - include warn logs too
    let level;
    if (i < 3) {
      level = "error";
    } else if (i < 6) {
      level = "warn";
    } else {
      level = "info";
    }

    // Create different messages based on service and level
    let message = "";
    if (level === "error") {
      message = `Sample error message #${i + 1} for ${baseService}`;
    } else if (level === "warn") {
      message = `Sample warning message #${i + 1} for ${baseService}`;
    } else {
      message = `Sample info message #${i + 1} for ${baseService}`;
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

// Mock file system structure for development
const mockFileSystem: Record<string, any> = {
  src: {
    components: {
      "Button.tsx": `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export const Button = ({ 
  children, 
  onClick, 
  variant = 'primary',
  disabled = false 
}: ButtonProps) => {
  return (
    <button 
      className={\`button \${variant}\`} 
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};`,
      "Input.tsx": `import React from 'react';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'email';
}

export const Input = ({
  value,
  onChange,
  placeholder,
  type = 'text'
}: InputProps) => {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input"
    />
  );
};`,
    },
    services: {
      "api.ts": `// API service for making network requests

/**
 * Fetch data from the API
 * @param url The URL to fetch from
 * @param options Optional fetch options
 * @returns The response data
 */
export async function fetchData<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(\`HTTP error: \${response.status}\`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}`,
      "auth.ts": `// Authentication service

interface User {
  id: string;
  username: string;
  email: string;
}

/**
 * Login the user
 * @param username The username
 * @param password The password
 * @returns The user object
 */
export async function login(username: string, password: string): Promise<User> {
  // This would normally make a network request
  return {
    id: '123',
    username,
    email: \`\${username}@example.com\`,
  };
}

/**
 * Check if the user is authenticated
 * @returns Whether the user is authenticated
 */
export function isAuthenticated(): boolean {
  return localStorage.getItem('auth_token') !== null;
}`,
    },
    utils: {
      "logger.ts": `// Logging utility

type LogLevel = 'info' | 'warn' | 'error';

class Logger {
  private prefix: string;
  
  constructor(prefix: string = '') {
    this.prefix = prefix ? \`[\${prefix}] \` : '';
  }
  
  info(message: string, ...args: any[]): void {
    console.info(\`\${this.prefix}\${message}\`, ...args);
  }
  
  warn(message: string, ...args: any[]): void {
    console.warn(\`\${this.prefix}\${message}\`, ...args);
  }
  
  error(message: string, ...args: any[]): void {
    console.error(\`\${this.prefix}\${message}\`, ...args);
  }
}

export default new Logger('App');`,
      "formatters.ts": `// Formatting utilities

/**
 * Format a date
 * @param date The date to format
 * @param format The format to use
 * @returns The formatted date
 */
export function formatDate(date: Date, format: string = 'yyyy-MM-dd'): string {
  // Simple implementation
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  return format
    .replace('yyyy', year)
    .replace('MM', month)
    .replace('dd', day);
}

/**
 * Format a number as currency
 * @param amount The amount to format
 * @param currency The currency code
 * @returns The formatted currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}`,
    },
    "App.tsx": `import React from 'react';
import { Button } from './components/Button';
import { Input } from './components/Input';
import logger from './utils/logger';

export const App = () => {
  const [value, setValue] = React.useState('');
  
  const handleClick = () => {
    logger.info('Button clicked with value:', value);
  };
  
  return (
    <div className="app">
      <h1>Sample App</h1>
      <Input
        value={value}
        onChange={setValue}
        placeholder="Type something..."
      />
      <Button onClick={handleClick}>
        Submit
      </Button>
    </div>
  );
};`,
    "index.tsx": `import React from 'react';
import ReactDOM from 'react-dom';
import { App } from './App';
import './styles.css';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);`,
  },
  "package.json": `{
  "name": "sample-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^4.9.5"
  }
}`,
  "tsconfig.json": `{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}`,
  "README.md": `# Sample App

This is a mock repository for testing the file explorer functionality.

## Features

- TypeScript React application
- Component library
- Utility functions
- API services

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start the development server
npm start
\`\`\``,
};

// Helper function to convert the mock file system to tree nodes
const convertMockToTreeNodes = (
  obj: Record<string, any>,
  basePath: string = ""
): FileTreeNode[] => {
  return Object.entries(obj).map(([name, value]) => {
    const path = basePath ? `${basePath}/${name}` : name;
    const isDirectory = typeof value === "object";

    if (isDirectory) {
      return {
        name,
        path,
        isDirectory: true,
        children: convertMockToTreeNodes(value, path),
      };
    } else {
      return {
        name,
        path,
        isDirectory: false,
      };
    }
  });
};

// Get content of a mock file
const getMockFileContent = (filePath: string): string | null => {
  const parts = filePath.split("/");
  let current: any = mockFileSystem;

  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return null;
    }
    current = current[part];
  }

  if (typeof current !== "string") {
    return null;
  }

  return current;
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
  const serviceBreakdown = services.map((service, index) => {
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
    "src/services/auth.ts",
    `// Authentication service

interface User {
  id: string;
  username: string;
  email: string;
}

/**
 * Login the user
 * @param username The username
 * @param password The password
 * @returns The user object
 */
export async function login(username: string, password: string): Promise<User> {
  // This would normally make a network request
  return {
    id: '123',
    username,
    email: \`\${username}@example.com\`,
  };
}

/**
 * Check if the user is authenticated
 * @returns Whether the user is authenticated
 */
export function isAuthenticated(): boolean {
  return localStorage.getItem('auth_token') !== null;
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
          (term: string) =>
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
          (term: string) =>
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
   * Get the file tree structure for a repository path
   */
  getFileTree: async (repoPath: string): Promise<ApiResponse<FileTreeNode[]>> => {
    console.info("Mock getFileTree called with:", repoPath);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Convert the mock file system to tree nodes
    const fileTree = convertMockToTreeNodes(mockFileSystem);

    return {
      success: true,
      data: fileTree,
    };
  },

  /**
   * Get the content of a file
   */
  getFileContent: async (repoPath: string, filePath: string): Promise<ApiResponse<string>> => {
    console.info("Mock getFileContent called with:", { repoPath, filePath });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Get the file content from the mock file system
    const content = getMockFileContent(filePath);

    if (content !== null) {
      return {
        success: true,
        data: content,
      };
    } else {
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }
  },
};

export default mockElectronAPI;
