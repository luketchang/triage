import fs from "fs";
import path from "path";

import { logger } from "./logging";

// Directories to exclude when collecting source code
const EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "__test__",
  "__tests__",
  "__mocks__",
  ".next",
  ".cache",
];

// File extensions to exclude
const EXCLUDED_EXTENSIONS = [".json", ".md", ".log", ".lock"];

// Default included extensions
const DEFAULT_INCLUDED_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".yaml",
  ".yml",
  ".py",
  ".java",
  ".go",
  ".rs",
];

/**
 * Checks if a path should be excluded based on whether it contains any excluded directory
 * @param filePath Path to check
 * @returns Boolean indicating if the path should be excluded
 */
function isExcluded(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath);
  return EXCLUDED_DIRS.some((dir) => normalizedPath.includes(`${path.sep}${dir}${path.sep}`));
}

/**
 * Collects source code from files in a directory and returns as a Map<string, string>
 * @param directory Base directory to search from
 * @param includedExtensions File extensions to include (defaults to common source code extensions)
 * @returns Map with absolute file paths as keys and file contents as values
 */
export function collectSourceCode(
  directory: string,
  includedExtensions: string[] = DEFAULT_INCLUDED_EXTENSIONS
): Map<string, string> {
  const sourceCodeMap = new Map<string, string>();

  try {
    collectSourceCodeRecursive(directory, sourceCodeMap, includedExtensions);
    logger.info(`Collected source code from ${sourceCodeMap.size} files in ${directory}`);
    return sourceCodeMap;
  } catch (error) {
    logger.error(`Error collecting source code from ${directory}: ${error}`);
    return sourceCodeMap;
  }
}

/**
 * Recursively traverses directories to collect source code files
 * @param currentDir Current directory to process
 * @param sourceCodeMap Map to store the collected source code
 * @param includedExtensions File extensions to include
 */
function collectSourceCodeRecursive(
  currentDir: string,
  sourceCodeMap: Map<string, string>,
  includedExtensions: string[]
): void {
  // Read directory contents
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);

    // Skip excluded directories
    if (isExcluded(entryPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively process directories
      collectSourceCodeRecursive(entryPath, sourceCodeMap, includedExtensions);
    } else if (entry.isFile()) {
      const extension = path.extname(entry.name);

      // Skip excluded extensions
      if (EXCLUDED_EXTENSIONS.includes(extension)) {
        continue;
      }

      // Include only specific extensions if provided
      if (includedExtensions.length > 0 && !includedExtensions.includes(extension)) {
        continue;
      }

      try {
        // Read file content
        const content = fs.readFileSync(entryPath, { encoding: "utf-8" });
        const absolutePath = path.resolve(entryPath);
        sourceCodeMap.set(absolutePath, content);
      } catch (error) {
        logger.warn(`Could not read file ${entryPath}: ${error}`);
      }
    }
  }
}
