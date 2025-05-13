import * as fs from "fs/promises";
import * as path from "path";

import {
  ALLOWED_EXTENSIONS,
  chunkArray,
  getDirectoryTree,
  getPathToSourceCodeMap,
  logger,
} from "@triage/common";
import { LanguageModelV1 } from "ai";

import { identifyTopLevelServices } from "./service-identification";
import { generateDirectorySummary, mergeAllSummaries } from "./summarization";
import { getTopLevelDirectories } from "./utils";

/**
 * Progress update for codebase overview generation
 */
export interface CodebaseOverviewProgressUpdate {
  status: "started" | "processing" | "completed" | "error";
  message: string;
  progress: number;
}

/**
 * Main class for processing a codebase to generate an overview
 */
export class CodebaseProcessor {
  private chunkSize: number = 8;
  private allowedExtensions: string[] = ALLOWED_EXTENSIONS;

  constructor(
    private readonly llmClient: LanguageModelV1,
    private readonly repoPath: string,
    private readonly systemDescription = "",
    private readonly options: {
      chunkSize?: number;
      outputDir?: string;
      onProgress?: (update: CodebaseOverviewProgressUpdate) => void;
    } = {}
  ) {
    this.chunkSize = options.chunkSize || 8;
  }

  /**
   * Send progress update to the caller if onProgress is provided
   */
  private updateProgress(update: CodebaseOverviewProgressUpdate): void {
    logger.info(`Progress update: ${update.message}`);
    if (this.options.onProgress) {
      this.options.onProgress(update);
    }
  }

  /**
   * Process the repository to generate a codebase overview
   */
  public async process(): Promise<string> {
    try {
      this.updateProgress({
        status: "processing",
        message: "Analyzing directory structure...",
        progress: 5,
      });

      // Create file tree for the repository
      const repoFileTree = await getDirectoryTree(this.repoPath, this.allowedExtensions);

      // Identify service directories
      const serviceDirs = await identifyTopLevelServices(
        this.llmClient,
        this.repoPath,
        repoFileTree
      );
      let directoriesToProcess: string[];

      if (serviceDirs.length > 0) {
        directoriesToProcess = serviceDirs;
        logger.info(`Identified service directories: ${directoriesToProcess}`);
      } else {
        directoriesToProcess = await getTopLevelDirectories(this.repoPath);
        logger.info(
          "No specific service directories identified; falling back to major directories."
        );
      }

      // Process each directory
      const summaries: Record<string, string> = {};
      const directoryChunks = chunkArray(directoriesToProcess, this.chunkSize);

      let completedDirs = 0;
      const totalDirs = directoriesToProcess.length;

      for (const [_, chunk] of directoryChunks.entries()) {
        const summaryPromises = chunk.map(
          async (directory: string): Promise<{ directory: string; summary: string }> => {
            // Update progress before starting directory processing
            this.updateProgress({
              status: "processing",
              message: `Processing directory: ${directory}`,
              progress: 15 + Math.floor((70 * completedDirs) / totalDirs),
            });

            // Create file tree for this directory
            const dirFileTree = await getDirectoryTree(directory, this.allowedExtensions);

            // Collect file contents
            const pathToSourceCode = await getPathToSourceCodeMap(
              directory,
              this.repoPath,
              this.allowedExtensions
            );

            const summary = await generateDirectorySummary(
              this.llmClient,
              this.systemDescription,
              directory,
              dirFileTree,
              pathToSourceCode,
              repoFileTree
            );

            completedDirs++;

            logger.info(`Summary for ${directory}:\n${summary}`);
            return { directory, summary };
          }
        );

        // Wait for current chunk to complete
        const summaryResults = await Promise.all(summaryPromises);
        Object.assign(
          summaries,
          Object.fromEntries(summaryResults.map(({ directory, summary }) => [directory, summary]))
        );
      }

      // Merge all summaries
      this.updateProgress({
        status: "processing",
        message: "Merging all directory summaries (this may take a while)...",
        progress: 85,
      });
      const finalDocument = await mergeAllSummaries(
        this.llmClient,
        this.systemDescription,
        summaries,
        repoFileTree
      );

      // Send completed progress update
      this.updateProgress({
        status: "completed",
        message: "Codebase overview generated successfully!",
        progress: 100,
      });

      if (this.options.outputDir) {
        await fs.mkdir(this.options.outputDir, { recursive: true });
        const outputPath = path.join(this.options.outputDir, "codebase-overview.md");
        await fs.writeFile(outputPath, finalDocument);
        logger.info(`Saved codebase overview to ${outputPath}`);
      }

      return finalDocument;
    } catch (error) {
      // Send error progress update
      this.updateProgress({
        status: "error",
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        progress: 0,
      });

      logger.error(`Error processing codebase: ${error}`);
      throw error;
    }
  }
}
