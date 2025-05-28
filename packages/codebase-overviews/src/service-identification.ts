import * as fs from "fs/promises";
import * as path from "path";

import { isAbortError, logger } from "@triage/common";
import { generateText, LanguageModelV1 } from "ai";

import { SelectedModules, selectedModulesSchema } from "./types";

/**
 * System prompt specific to the service identification task
 */
export const SERVICE_IDENTIFICATION_SYSTEM_PROMPT = `
You are an expert AI assistant that helps analyze codebases and identify key services, modules, or components.
Your task is to identify logically separate parts of the codebase that should be analyzed individually.
`;

/**
 * Define the tool schema for service identification
 */
export const selectedModulesTool = {
  name: "selectedModules",
  description: "Select the main service modules from the codebase",
  parameters: selectedModulesSchema,
} as const;

/**
 * Generates a prompt for top-level module identification
 */
export function createTopLevelIdentificationPrompt(params: { repoFileTree: string }): string {
  return `
You are given the file tree of a repository. Your task is to identify upper-level directories that represent separate services, components, or top-level modules that should be analyzed individually in depth.

Look for directories that represent:
- Microservices
- API services
- Frontend applications
- Backend services 
- Shared libraries or utilities
- Infrastructure configurations
- Domain-specific modules
- Major system components

These directories are logically independent components that require in-depth technical analysis individually. Be thorough and include all potentially significant directories.

Return a JSON array of directory paths (relative to the repository root) that should be treated as separate services or modules for detailed analysis. Prioritize recall over precision - be inclusive about which directories might contain important code. Note that you must choose directories not actual files.

Repository File Tree:
${params.repoFileTree}
`;
}

/**
 * Identifies top-level services or modules in a codebase
 */
export async function identifyTopLevelServices(
  llmClient: LanguageModelV1,
  repoPath: string,
  repoFileTree: string,
  abortSignal?: AbortSignal
): Promise<string[]> {
  logger.info(`File tree: ${repoFileTree}`);

  try {
    const prompt = createTopLevelIdentificationPrompt({
      repoFileTree: repoFileTree,
    });
    logger.info(`Using prompt: ${prompt}`);

    // Use AI to identify services with tool calls
    const { toolCalls } = await generateText({
      model: llmClient,
      system: SERVICE_IDENTIFICATION_SYSTEM_PROMPT,
      prompt,
      tools: {
        selectedModules: selectedModulesTool,
      },
      toolChoice: "required",
      abortSignal,
    });

    if (!toolCalls || toolCalls.length === 0) {
      logger.warn("No service directories identified; falling back to major directories.");
      return [];
    }

    const toolCall = toolCalls[0];
    if (!toolCall) {
      logger.warn("No tool call returned; falling back to major directories.");
      return [];
    }

    if (toolCall.toolName !== "selectedModules") {
      throw new Error(`Unexpected tool name: ${toolCall.toolName}`);
    }

    const result = toolCall.args as SelectedModules;
    logger.info(`Service identification structured output: ${JSON.stringify(result, null, 2)}`);

    const selections = result?.selections || [];
    if (selections.length === 0) {
      logger.info("No service directories identified; falling back to major directories.");
      return [];
    }

    const absServiceDirs: string[] = [];
    for (const selection of selections) {
      const relPath = selection.module;
      const absPath = path.join(repoPath, relPath);
      try {
        const stat = await fs.stat(absPath);
        if (stat.isDirectory()) {
          absServiceDirs.push(absPath);
        } else {
          logger.warn(`Identified service path '${relPath}' is not a directory.`);
        }
      } catch {
        logger.warn(`Identified service directory '${relPath}' does not exist in the repository.`);
      }
    }
    return absServiceDirs;
  } catch (error) {
    // If the operation was aborted, propagate the error
    if (isAbortError(error)) {
      logger.info(`Service identification aborted: ${error}`);
      throw error; // Don't retry on abort
    }

    logger.error(`Error processing service identification: ${error}`);
    return [];
  }
}
