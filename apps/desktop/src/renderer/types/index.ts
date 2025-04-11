// Types and interfaces for the application

// Import types from packages instead of redefining them
import { LogSearchInput, LogSearchInputCore, PostprocessedLogSearchInput } from "@triage/agent";

import {
  IntegrationType,
  Log,
  LogsWithPagination,
  Span,
  SpansWithPagination,
} from "@triage/observability";

// Re-export imported types
export type {
  IntegrationType,
  Log,
  LogSearchInput,
  LogSearchInputCore,
  LogsWithPagination,
  PostprocessedLogSearchInput,
  Span,
  SpansWithPagination,
};

// Define code map type alias
export type CodeMap = Map<string, string>;

// Define the AgentConfig interface - specific to desktop app
export interface AgentConfig {
  repoPath: string;
  codebaseOverviewPath: string;
  observabilityPlatform: string;
  observabilityFeatures: string[];
  startDate: Date;
  endDate: Date;
}

// Define facet data type
export interface FacetData {
  name: string;
  values: string[];
  counts?: number[];
}

// Define log query params type
export interface LogQueryParams {
  query: string;
  start: string;
  end: string;
  limit: number;
  pageCursor?: string;
}

// Interface for log search parameters - simplified version of LogSearchInput for UI
export interface LogSearchParams {
  query: string;
  start: string;
  end: string;
  searchParams: any;
  pageCursor?: string;
}

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
