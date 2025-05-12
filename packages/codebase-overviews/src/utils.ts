import fs from "fs/promises";
import path from "path";

import { logger } from "@triage/common";
import { globby } from "globby";

// Get major directories (top-level directories that aren't ignored)
export async function getMajorDirectories(repoPath: string): Promise<string[]> {
  try {
    // Use globby to get all top-level directories, respecting .gitignore and .git
    const dirs = await globby("*", {
      cwd: repoPath,
      onlyDirectories: true,
      gitignore: true,
      ignore: [".git"],
      dot: true,
      absolute: false,
      followSymbolicLinks: false,
    });
    
    return dirs.map((d) => path.join(repoPath, d));
  } catch (error) {
    logger.error(`Error listing major directories: ${error}`);
    return [];
  }
}

/**
 * Creates a file tree structure from a directory, respecting .gitignore patterns
 */
export async function createFileTree(
  directory: string,
  allowedExtensions: string[]
): Promise<string> {
  // Get all directories and files
  const [dirPaths, filePaths] = await Promise.all([
    globby("**/*", {
      cwd: directory,
      onlyDirectories: true,
      dot: true,
      absolute: false,
      followSymbolicLinks: false,
      gitignore: true,
      ignore: [".git"],
    }),
    globby(
      allowedExtensions.length > 0 ? allowedExtensions.map((ext) => `**/*${ext}`) : ["**/*"],
      {
        cwd: directory,
        onlyFiles: true,
        dot: true,
        absolute: false,
        followSymbolicLinks: false,
        gitignore: true,
        ignore: [".git"],
      }
    ),
  ]);

  // Build the file tree structure
  const fileTreeLines: string[] = [];

  // Sort paths to ensure parent directories come before their children
  const sortedPaths = [...dirPaths, ...filePaths].sort();

  // Build the tree structure
  for (const relativePath of sortedPaths) {
    const pathParts = relativePath.split(path.sep);
    const depth = pathParts.length - 1;
    const name = pathParts[pathParts.length - 1];
    const isDirectory = dirPaths.includes(relativePath);

    fileTreeLines.push(`${" ".repeat(depth * 2)}${name}${isDirectory ? "/" : ""}`);
  }

  return fileTreeLines.join("\n");
}

/**
 * Collects file contents from a directory
 * Returns a map of relative file paths to their source code
 */
export async function collectFiles(
  directory: string,
  allowedExtensions: string[],
  repoRoot: string
): Promise<Record<string, string>> {
  const MAX_FILE_SIZE = 1024 * 1024; // 1MB

  // Use globby to find files, respecting .gitignore and .git
  const filePaths = await globby(
    allowedExtensions.length > 0 ? allowedExtensions.map((ext) => `**/*${ext}`) : ["**/*"],
    {
      cwd: directory,
      onlyFiles: true,
      dot: true,
      absolute: false,
      followSymbolicLinks: false,
      gitignore: true,
      ignore: [".git"],
    }
  );

  // Collect file contents
  const pathToSourceCode: Record<string, string> = {};
  for (const filePath of filePaths) {
    try {
      const fullPath = path.join(directory, filePath);
      const relativePath = path.relative(repoRoot, fullPath);
      const stats = await fs.stat(fullPath);

      if (stats.size <= MAX_FILE_SIZE) {
        const content = await fs.readFile(fullPath, "utf-8");
        pathToSourceCode[relativePath] = content;
      } else {
        pathToSourceCode[relativePath] = `File too large to include (${stats.size} bytes)`;
      }
    } catch (error) {
      logger.error(`Error reading file ${filePath}: ${error}`);
    }
  }

  return pathToSourceCode;
}
