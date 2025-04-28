import { execSync, spawnSync } from "child_process";
import fs from "fs";
import * as path from "path";

import { logger } from "./logging";

/**
 * Gets the source code from the given file paths.
 * @param filePaths The file paths to get the source code from.
 * @returns A mapping from file paths to their source code.
 */
export function getSourceCodeFromPaths(filePaths: string[]): Map<string, string> {
  const pathToSourceCode: Map<string, string> = new Map();

  filePaths.forEach((filePath) => {
    try {
      const content = fs.readFileSync(filePath, { encoding: "utf-8" });
      pathToSourceCode.set(filePath, content);
    } catch (error) {
      const errMsg = `Error reading file: ${error}`;
      pathToSourceCode.set(filePath, errMsg);
      console.error(`Could not read file ${filePath}: ${error}`);
      throw error;
    }
  });

  return pathToSourceCode;
}

/**
 * Load the file tree for the given repository path.
 * @param repoPath Path to the repository.
 * @returns File tree string.
 */
export function loadFileTree(repoPath: string): string {
  try {
    // Use the find command to get a list of files.
    const output = execSync(
      `find ${repoPath} -type f -not -path "*/node_modules/*" -not -path "*/\\.git/*" | sort`,
      { encoding: "utf-8" }
    );
    return output;
  } catch (error) {
    console.error("Failed to load file tree:", error);
    return "Failed to load file tree";
  }
}

/**
 * Searches one directory using ripgrep (rg) and returns a mapping
 * from file paths to their full file contents.
 *
 * @param params - Options for the search.
 *   - directory: Directory to search in.
 *   - content_regex (optional): Regex pattern to match within file contents. Defaults to "." (all content).
 *   - file_path_regex (optional): Glob pattern to filter files by their absolute paths.
 *   - allowedExtensions: An optional array of file extensions to consider.
 *
 * @returns A formatted string mapping file paths to file contents.
 */
export function ripgrepSearch(params: {
  directory: string;
  content_regex?: string;
  file_path_regex?: string;
  allowedExtensions?: string[];
}): string {
  const {
    directory,
    content_regex = ".",
    file_path_regex,
    allowedExtensions = [".py", ".ts", ".js", ".java", ".go", ".rs", ".yaml"],
  } = params;

  // Default content regex to "." if not provided.
  const effectiveContentRegex = content_regex || ".";

  // Build arguments for the rg command.
  const args = [effectiveContentRegex, directory];
  if (file_path_regex) {
    // Use the -g flag to filter files by their paths.
    args.push("-g", file_path_regex);
    logger.info(
      `Searching in ${directory} with content regex: ${String(effectiveContentRegex)} and file path filter: ${String(file_path_regex)}`
    );
  } else {
    logger.info(`Searching in ${directory} with content regex: ${String(effectiveContentRegex)}`);
  }

  // Execute the rg command with the constructed arguments.
  const procResult = spawnSync("rg", args, { encoding: "utf-8" });

  // ripgrep returns exit code 1 when no matches are found.
  if (procResult.status !== 0 && procResult.status !== 1) {
    const error = `Error running rg in ${directory}: ${procResult.stderr}`;
    console.error(error);
    return `No matches found. ${error}`;
  }

  const stdout: string = procResult.stdout;
  const fileMatches: Record<string, string[]> = {};
  stdout.split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex !== -1) {
      const filePath = line.slice(0, colonIndex);
      const contentLine = line.slice(colonIndex + 1);
      if (!fileMatches[filePath]) {
        fileMatches[filePath] = [];
      }
      fileMatches[filePath].push(contentLine);
    }
  });

  // For each matching file, check allowed extensions and read its full content.
  const resultMap: Record<string, string> = {};
  for (const filePath in fileMatches) {
    const ext = path.extname(filePath);
    if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
      continue;
    }
    if (resultMap[filePath]) continue;
    try {
      const content = fs.readFileSync(filePath, { encoding: "utf-8" });
      resultMap[filePath] = content;
    } catch (error) {
      if (error instanceof Error) {
        resultMap[filePath] = `Error reading file: ${error.message}`;
      } else {
        resultMap[filePath] = "Error reading file: Unknown error";
      }
    }
  }

  return formatCodeMap(new Map(Object.entries(resultMap)));
}

/**
 * Helper function to pretty-format a mapping of file paths to contents.
 *
 * @param codeMap - Mapping from file path to code content.
 * @returns A formatted string.
 */
export function formatCodeMap(codeMap: Map<string, string>): string {
  let formattedOutput = "";
  for (const [filePath, code] of codeMap.entries()) {
    const header = `File: ${filePath}`;
    const separator = "-".repeat(header.length);
    formattedOutput += `${separator}\n${header}\n${separator}\n${code}\n\n`;
  }
  return formattedOutput;
}
