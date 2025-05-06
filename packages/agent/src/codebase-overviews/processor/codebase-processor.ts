import { Model, getModelWrapper, logger } from "@triage/common";
import { generateText } from "ai";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { SelectedModules, selectedModulesSchema } from "../types";
import {
  DIR_SUMMARY_TEMPLATE,
  MERGE_SUMMARIES_TEMPLATE,
  TOP_LEVEL_IDENTIFICATION_TEMPLATE,
} from "./templates";
import { cloneRepository, collectFiles, generateTreeString, listMajorDirectories } from "./utils";

const SYSTEM_PROMPT = `
You are an expert AI assistant that helps analyze codebases and generate comprehensive overviews. Your task is to identify services and generate summaries of codebase components.
`;

// Define the tool schema for service identification
const selectedModulesTool = {
  name: "selectedModules",
  description: "Select the main service modules from the codebase",
  parameters: selectedModulesSchema,
} as const;

/**
 * Main class for processing a codebase to generate an overview
 */
export class CodebaseProcessor {
  private llm: Model;
  private repoUrl: string;
  private systemDescription: string;
  private allowedExtensions: string[];

  constructor(llm: Model, repoUrl: string, systemDescription = "") {
    this.llm = llm;
    this.repoUrl = repoUrl;
    this.systemDescription = systemDescription;
    this.allowedExtensions = [".py", ".js", ".ts", ".java", ".go", ".rs", ".yaml", ".cs"];
  }

  /**
   * Identify service directories using LLM
   */
  private async identifyTopLevel(repoPath: string, repoFileTree: string[]): Promise<string[]> {
    const treeStr = generateTreeString(repoFileTree);
    logger.info(`File tree: ${treeStr}`);

    try {
      const prompt = TOP_LEVEL_IDENTIFICATION_TEMPLATE.replace("{repo_file_tree}", treeStr);
      logger.info(`Using prompt: ${prompt}`);

      // Use AI to identify services with tool calls
      logger.info(`Attempting to use AI model: ${this.llm}`);
      const { toolCalls } = await generateText({
        model: getModelWrapper(this.llm),
        system: SYSTEM_PROMPT,
        prompt,
        tools: {
          selectedModules: selectedModulesTool,
        },
        toolChoice: "auto",
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
            logger.info(`Identified service path '${relPath}' is not a directory.`);
          }
        } catch (error) {
          logger.info(
            `Identified service directory '${relPath}' does not exist in the repository.`
          );
        }
      }
      return absServiceDirs;
    } catch (error) {
      logger.error(`Error processing service identification: ${error}`);
      return [];
    }
  }

  /**
   * Generate a summary for a specific directory
   */
  private async generateDirectorySummary(
    directory: string,
    dirFileTree: string[],
    fileContents: Record<string, string>,
    repoFileTree: string[]
  ): Promise<string> {
    let fileContentsStr = "";
    for (const [path, content] of Object.entries(fileContents)) {
      fileContentsStr += `\nFile: ${path}\n${"-".repeat(40)}\n${content}\n${"-".repeat(40)}\n`;
    }

    const prompt = DIR_SUMMARY_TEMPLATE.replace("{system_description}", this.systemDescription)
      .replace("{repo_file_tree}", generateTreeString(repoFileTree))
      .replace("{directory}", directory)
      .replace("{dir_file_tree}", generateTreeString(dirFileTree))
      .replace("{file_contents}", fileContentsStr);

    try {
      const { text } = await generateText({
        model: getModelWrapper(this.llm),
        system: SYSTEM_PROMPT,
        prompt,
      });

      return text;
    } catch (error) {
      logger.error(`Error generating directory summary: ${error}`);
      return `Error generating summary for ${directory}: ${error}`;
    }
  }

  /**
   * Merge all directory summaries into a final document
   */
  private async mergeAllSummaries(
    summaries: Record<string, string>,
    repoFileTree: string[]
  ): Promise<string> {
    let summariesStr = "";
    for (const [directory, summary] of Object.entries(summaries)) {
      summariesStr += `Walkthrough for ${directory}:\n${summary}\n\n`;
    }

    const prompt = MERGE_SUMMARIES_TEMPLATE.replace("{system_description}", this.systemDescription)
      .replace("{repo_file_tree}", generateTreeString(repoFileTree))
      .replace("{summaries}", summariesStr);

    try {
      const { text } = await generateText({
        model: getModelWrapper(this.llm),
        system: SYSTEM_PROMPT,
        prompt,
      });

      return text;
    } catch (error) {
      logger.error(`Error merging summaries: ${error}`);
      return `Error generating final document: ${error}`;
    }
  }

  /**
   * Process the repository to generate a codebase overview
   */
  public async process(): Promise<string> {
    // Create temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "repo-"));

    try {
      // Clone repository
      cloneRepository(this.repoUrl, tempDir);
      const repoPath = tempDir;

      // Collect files from the repository
      const { fileTree: repoFileTree } = await collectFiles(
        repoPath,
        this.allowedExtensions,
        repoPath
      );

      // Identify service directories
      const serviceDirs = await this.identifyTopLevel(repoPath, repoFileTree);
      let directoriesToProcess: string[];

      if (serviceDirs.length > 0) {
        directoriesToProcess = serviceDirs;
        logger.info(`Identified service directories: ${directoriesToProcess}`);
      } else {
        directoriesToProcess = await listMajorDirectories(repoPath);
        logger.info(
          "No specific service directories identified; falling back to major directories."
        );
      }

      // Process each directory
      const summaries: Record<string, string> = {};
      for (const directory of directoriesToProcess) {
        logger.info(`Processing directory: ${directory}`);

        const { fileTree: dirFileTree, pathToSourceCode } = await collectFiles(
          directory,
          this.allowedExtensions,
          repoPath
        );

        const summary = await this.generateDirectorySummary(
          directory,
          dirFileTree,
          pathToSourceCode,
          repoFileTree
        );

        summaries[directory] = summary;
        logger.info(`Summary for ${directory}:\n${summary}`);
      }

      // Merge all summaries
      logger.info("Merging all summaries...");
      const finalDocument = await this.mergeAllSummaries(summaries, repoFileTree);
      logger.info(`Final Document:\n${finalDocument}`);

      return finalDocument;
    } finally {
      // Clean up temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        logger.error(`Error cleaning up temporary directory: ${error}`);
      }
    }
  }
}
