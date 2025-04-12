import { LogSearchInputCore, PostprocessedLogSearchInput } from "@triage/agent";
import { LogsWithPagination } from "@triage/observability";
import { Artifact } from "../types";
import { generateId } from "./formatters";

// Helper function to convert log context to Artifact array
export const createLogArtifacts = (
  logPostprocessing: Map<
    PostprocessedLogSearchInput | LogSearchInputCore,
    LogsWithPagination | string
  > | null
): Artifact[] => {
  if (!logPostprocessing) {
    return [];
  }

  const artifacts: Artifact[] = [];

  // Check if we're dealing with a Map
  logPostprocessing.forEach((value, key) => {
    if (value && key) {
      // Create a log search input core with just the query and time range info
      const logSearchInput: LogSearchInputCore = {
        query: key.query,
        start: key.start,
        end: key.end,
        limit: key.limit || 100,
        pageCursor: key.pageCursor || null,
        type: "logSearchInput",
      };

      // Use key.title if available (for PostprocessedLogSearchInput) or fallback to query
      const artifactTitle = "title" in key ? key.title : "Log Analysis";

      artifacts.push({
        id: generateId(),
        type: "log",
        title: artifactTitle,
        description: "summary" in key ? key.summary : "Log data summary",
        data: {
          input: logSearchInput,
          results: value,
        },
      });
    }
  });

  return artifacts;
};

// Helper function to convert code context to Artifact array
export const createCodeArtifacts = (codePostprocessing: Map<string, string> | null): Artifact[] => {
  if (!codePostprocessing) {
    return [];
  }

  return [
    {
      id: generateId(),
      type: "code",
      title: "Code Analysis",
      description: "Code snippets",
      data: codePostprocessing,
    },
  ];
};
