import { Model, getModelWrapper, logger } from "@triage/common";
import { generateText } from "ai";
import * as fs from "fs/promises";
import * as path from "path";
import {
  createDirectorySummaryPrompt,
  createMergeSummariesPrompt,
  createTopLevelIdentificationPrompt,
} from "./templates";
import { SelectedModules, selectedModulesSchema } from "./types";
import { collectFiles, getMajorDirectories } from "./utils";

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
  private repoPath: string;
  private outputDir: string;
  private systemDescription: string;
  private allowedExtensions: string[];

  constructor(llm: Model, repoPath: string, outputDir: string, systemDescription = "") {
    this.llm = llm;
    this.repoPath = repoPath;
    this.outputDir = outputDir;
    this.systemDescription = systemDescription;
    this.allowedExtensions = [".py", ".js", ".ts", ".java", ".go", ".rs", ".yaml", ".cs"];
  }

  /**
   * Identify top level directories using LLM
   */
  private async identifyTopLevel(repoPath: string, repoFileTree: string[]): Promise<string[]> {
    const treeStr = repoFileTree.join("\n");
    logger.info(`File tree: ${treeStr}`);

    try {
      const prompt = createTopLevelIdentificationPrompt({
        repoFileTree: treeStr,
      });
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
    const prompt = createDirectorySummaryPrompt({
      systemDescription: this.systemDescription,
      repoFileTree: repoFileTree.join("\n"),
      directory,
      dirFileTree: dirFileTree.join("\n"),
      fileContents,
    });

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
    const prompt = createMergeSummariesPrompt({
      systemDescription: this.systemDescription,
      repoFileTree: repoFileTree.join("\n"),
      summaries,
    });

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
    // Create the output directory if it doesn't exist
    await fs.mkdir(this.outputDir, { recursive: true });

    try {
      // Collect files from the repository using the unified collectFiles function
      const { fileTree: repoFileTree } = await collectFiles(
        this.repoPath,
        this.allowedExtensions,
        this.repoPath
      );

      // Identify service directories
      const serviceDirs = await this.identifyTopLevel(this.repoPath, repoFileTree);
      let directoriesToProcess: string[];

      if (serviceDirs.length > 0) {
        directoriesToProcess = serviceDirs;
        logger.info(`Identified service directories: ${directoriesToProcess}`);
      } else {
        directoriesToProcess = await getMajorDirectories(this.repoPath);
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
          this.repoPath
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

      // Save the final document to the output directory
      const outputPath = path.join(this.outputDir, "codebase-overview.md");
      await fs.writeFile(outputPath, finalDocument);
      logger.info(`Saved codebase overview to ${outputPath}`);

      return finalDocument;
    } catch (error) {
      logger.error(`Error processing codebase: ${error}`);
      throw error;
    }
  }
}
