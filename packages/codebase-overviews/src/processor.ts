import { chunkArray, logger } from "@triage/common";
import { LanguageModelV1 } from "ai";
import * as fs from "fs/promises";
import * as path from "path";
import { identifyTopLevelServices } from "./service-identification";
import { generateDirectorySummary, mergeAllSummaries } from "./summarization";
import { collectFiles, getMajorDirectories } from "./utils";

/**
 * Main class for processing a codebase to generate an overview
 */
export class CodebaseProcessor {
  private llmClient: LanguageModelV1;
  private repoPath: string;
  private systemDescription: string;
  private allowedExtensions: string[];
  private outputDir: string | undefined;
  private chunkSize: number = 8;

  constructor(
    llmClient: LanguageModelV1,
    repoPath: string,
    systemDescription = "",
    outputDir?: string,
    options: { chunkSize?: number } = {}
  ) {
    this.llmClient = llmClient;
    this.repoPath = repoPath;
    this.systemDescription = systemDescription;
    this.allowedExtensions = [".py", ".js", ".ts", ".java", ".go", ".rs", ".yaml", ".cs"];
    this.outputDir = outputDir;
    this.chunkSize = options.chunkSize || 8;
  }

  /**
   * Process the repository to generate a codebase overview
   */
  public async process(): Promise<string> {
    try {
      // Collect files from the repository using the unified collectFiles function
      const { fileTree: repoFileTree } = await collectFiles(
        this.repoPath,
        this.allowedExtensions,
        this.repoPath
      );

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
        directoriesToProcess = await getMajorDirectories(this.repoPath);
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

            const { fileTree: dirFileTree, pathToSourceCode } = await collectFiles(
              directory,
              this.allowedExtensions,
              this.repoPath
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
