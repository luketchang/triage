// Types and interfaces for the application
// TODO: lots of duplication between common/observability packages and this file

// Define the AgentConfig interface
export interface AgentConfig {
  repoPath: string;
  codebaseOverviewPath: string;
  observabilityPlatform: string;
  observabilityFeatures: string[];
  startDate: Date;
  endDate: Date;
}

// Define the Log interface for the UI
export interface Log {
  timestamp: string;
  message: string;
  service: string;
  level: string;
  attributes?: {
    [key: string]: any;
  };
  metadata?: Record<string, string>;
}

// Interface for log search parameters
export interface LogSearchParams {
  query: string;
  start: string;
  end: string;
  searchParams: any;
  pageCursor?: string;
}

// Type for code artifacts
export type CodeMap = Map<string, string>;

// Type for artifact types
export type ArtifactType = "code" | "image" | "document" | "log" | "trace" | "dashboard";

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  description: string;
  data: Log[] | CodeMap | string | LogSearchParams;
}

// Interface for context items that will be added to chat
export interface ContextItem {
  id: string;
  type: ArtifactType;
  title: string;
  description: string;
  data: Log[] | CodeMap | string | LogSearchParams;
  sourceTab: TabType;
}

// Interface for chat messages
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifacts?: Artifact[];
}

// Interface for main content tabs
export type TabType = "logs" | "traces" | "dashboards" | "code";

export interface TimeRange {
  start: string;
  end: string;
}

export interface TimeRangePreset {
  label: string;
  value: number | string;
}

export type { FacetData, LogQueryParams } from "../electron.d";
