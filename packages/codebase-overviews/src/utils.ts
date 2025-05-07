import { logger } from "@triage/common";
import fs from "fs/promises";
import { globby } from "globby";
import path from "path";
import { DEFAULT_IGNORELIST } from "./ignorelist";

// Get major directories (top-level directories that aren't ignored)
export async function getMajorDirectories(repoPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(repoPath, { withFileTypes: true });
    const majorDirs: string[] = [];

    // Get ignore patterns from .gitignore
    let ignorePatterns = [...DEFAULT_IGNORELIST];
    try {
      const gitignore = await fs.readFile(path.join(repoPath, ".gitignore"), "utf8");
      ignorePatterns = ignorePatterns.concat(
        gitignore
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"))
      );
    } catch {
      // .gitignore not present, that's fine
    }

    // Create a simple matcher function to check if a path is ignored
    const isIgnored = (dirName: string) => {
      return ignorePatterns.some((pattern) => {
        const simplifiedPattern = pattern.replace("**/", "").replace("/**", "");
        return dirName === simplifiedPattern || dirName.startsWith(simplifiedPattern + "/");
      });
    };

    for (const entry of entries) {
      if (entry.isDirectory() && !isIgnored(entry.name)) {
        majorDirs.push(path.join(repoPath, entry.name));
      }
    }

    return majorDirs;
  } catch (error) {
    logger.error(`Error listing major directories: ${error}`);
    return [];
  }
}

/**
 * Collects files from a directory, builds a tree structure, and gathers file contents
 * Returns both a file tree and source code map in the same format as the original collectFiles
 */
export async function collectFiles(
  directory: string,
  allowedExtensions: string[],
  repoRoot: string
): Promise<{ fileTree: string; pathToSourceCode: Record<string, string> }> {
  const MAX_FILE_SIZE = 1024 * 1024; // 1MB

  // Collect ignore patterns from .gitignore if present
  let ignorePatterns = [...DEFAULT_IGNORELIST];
  try {
    const gitignore = await fs.readFile(path.join(repoRoot, ".gitignore"), "utf8");
    ignorePatterns = ignorePatterns.concat(
      gitignore
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
    );
  } catch {
    // .gitignore not present, that's fine
  }

  // For content collection, find files with matching extensions
  const filePaths = await globby(
    allowedExtensions.length > 0 ? allowedExtensions.map((ext) => `**/*${ext}`) : ["**/*"],
    {
      cwd: directory,
      ignore: ignorePatterns,
      onlyFiles: true,
      dot: true,
      absolute: false,
      followSymbolicLinks: false,
    }
  );

  // For directory tree, use globby to get all directories
  const dirPaths = await globby("**/*", {
    cwd: directory,
    ignore: ignorePatterns,
    onlyDirectories: true,
    dot: true,
    absolute: false,
    followSymbolicLinks: false,
  });

  // Build the file tree structure
  const fileTreeLines: string[] = [];
  const pathToSourceCode: Record<string, string> = {};

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

  // Collect file contents
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

  return { fileTree: fileTreeLines.join("\n"), pathToSourceCode };
}
