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
 * Main class for processing a codebase to generate an overview
 */
export class CodebaseProcessor {
  private chunkSize: number = 8;
  private allowedExtensions: string[] = ALLOWED_EXTENSIONS;

  constructor(
    private readonly llmClient: LanguageModelV1,
    private readonly repoPath: string,
    private readonly systemDescription = "",
    private readonly outputDir?: string,
    options: { chunkSize?: number } = {}
  ) {
    this.chunkSize = options.chunkSize || 8;
  }

  /**
   * Process the repository to generate a codebase overview
   */
  public async process(): Promise<string> {
    try {
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

      for (const chunk of directoryChunks) {
        const summaryPromises = chunk.map(
          async (directory: string): Promise<{ directory: string; summary: string }> => {
            logger.info(`Processing directory: ${directory}`);

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
      logger.info("Merging all summaries...");
      const finalDocument = await mergeAllSummaries(
        this.llmClient,
        this.systemDescription,
        summaries,
        repoFileTree
      );
      logger.info(`Final Document:\n${finalDocument}`);

      // Save the final document to the output directory
      if (this.outputDir) {
        await fs.mkdir(this.outputDir, { recursive: true });
        const outputPath = path.join(this.outputDir, "codebase-overview.md");
        await fs.writeFile(outputPath, finalDocument);
        logger.info(`Saved codebase overview to ${outputPath}`);
      }

      return finalDocument;
    } catch (error) {
      logger.error(`Error processing codebase: ${error}`);
      throw error;
    }
  }
}
