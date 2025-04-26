// Types and interfaces for the application

// Import types from packages instead of redefining them
import { LogSearchInput, LogSearchInputCore, PostprocessedLogSearchInput } from "@triage/agent";

import { Log, LogsWithPagination } from "@triage/observability";

// Re-export imported types
export type {
  Log,
  LogSearchInput,
  LogSearchInputCore,
  LogsWithPagination,
  PostprocessedLogSearchInput,
};

// Define code map type alias
export type CodeMap = Map<string, string>;

// Enhanced CodeMap with repository and file path information
export interface EnhancedCodeMap extends CodeMap {
  repoPath?: string;
  filePath?: string;
}

// Define LogSearchPair type for storing pairs of search inputs and results
export interface LogSearchPair {
  input: LogSearchInputCore;
  results: LogsWithPagination | string;
}

// Define specific artifact types with discriminated union
export interface LogArtifact {
  id: string;
  type: "log";
  title: string;
  description: string;
  data: LogSearchPair;
}

export interface CodeArtifact {
  id: string;
  type: "code";
  title: string;
  description: string;
  data: EnhancedCodeMap;
}

// Artifact type as a discriminated union
export type Artifact = LogArtifact | CodeArtifact;

// Define specific context item types with discriminated union
export interface LogSearchContextItem {
  id: string;
  type: "logSearch";
  title: string;
  description: string;
  data: LogSearchPair;
  sourceTab?: string;
}

// Context item type as a discriminated union
export type ContextItem = LogSearchContextItem;

// Interface for chat messages
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifacts?: Artifact[];
  contextItems?: ContextItem[];
}
