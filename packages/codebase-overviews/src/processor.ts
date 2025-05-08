import { Model, logger } from "@triage/common";
import * as fs from "fs/promises";
import * as path from "path";
import { identifyTopLevelServices } from "./service-identification";
import { generateDirectorySummary, mergeAllSummaries } from "./summarization";
import { collectFiles, getMajorDirectories } from "./utils";

/**
 * Main class for processing a codebase to generate an overview
 */
export class CodebaseProcessor {
  private llm: Model;
  private repoPath: string;
  private systemDescription: string;
  private allowedExtensions: string[];
  private outputDir: string | undefined;

  constructor(llm: Model, repoPath: string, systemDescription = "", outputDir?: string) {
    this.llm = llm;
    this.repoPath = repoPath;
    this.systemDescription = systemDescription;
    this.allowedExtensions = [".py", ".js", ".ts", ".java", ".go", ".rs", ".yaml", ".cs"];
    this.outputDir = outputDir;
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
      const serviceDirs = await identifyTopLevelServices(this.llm, this.repoPath, repoFileTree);
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

        const summary = await generateDirectorySummary(
          this.llm,
          this.systemDescription,
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
      const finalDocument = await mergeAllSummaries(
        this.llm,
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
