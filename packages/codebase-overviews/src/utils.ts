import { logger } from "@triage/common";
import fs from "fs/promises";
import { globby } from "globby";
import path from "path";
import { DEFAULT_IGNORELIST } from "./ignorelist";

export type TreeNode = {
  name: string;
  children: TreeNode[];
  isDirectory: boolean;
};

function createTreeNode(name: string, isDirectory: boolean): TreeNode {
  return { name, children: [], isDirectory };
}

function addPathToTree(root: TreeNode, filePath: string) {
  const parts = filePath.split(path.sep);
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue; // Skip empty parts

    const isLast = i === parts.length - 1;
    let child = current.children.find((c) => c.name === part);
    if (!child) {
      child = createTreeNode(part, !isLast);
      current.children.push(child);
    }
    current = child;
  }
}

function treeToString(node: TreeNode, prefix = ""): string {
  let result = "";
  for (const child of node.children.sort((a, b) => a.name.localeCompare(b.name))) {
    result += `${prefix}${child.name}${child.isDirectory ? "/" : ""}\n`;
    if (child.isDirectory) {
      result += treeToString(child, prefix + "  ");
    }
  }
  return result;
}

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
          .map((line: string) => line.trim())
          .filter((line: string) => line && !line.startsWith("#"))
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
 * Returns both a file tree and source code map
 */
export async function collectFiles(
  directory: string,
  allowedExtensions: string[],
  repoRoot: string
): Promise<{ fileTree: string; pathToSourceCode: Record<string, string> }> {
  const MAX_FILE_SIZE = 1024 * 1024; // 1MB
  const MAX_DEPTH = 10;

  // Extract common ignore directories from DEFAULT_IGNORELIST
  const alwaysIgnoreDirs = DEFAULT_IGNORELIST.filter(
    (item) => item.endsWith("/") && !item.includes("*")
  ).map((item) => item.replace("/", ""));

  // Collect ignore patterns from .gitignore if present
  let ignorePatterns = [...DEFAULT_IGNORELIST];
  try {
    const gitignore = await fs.readFile(path.join(repoRoot, ".gitignore"), "utf8");
    ignorePatterns = ignorePatterns.concat(
      gitignore
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line && !line.startsWith("#"))
    );
  } catch {
    // .gitignore not present, that's fine
  }

  // This is a simplified check for ignoring a path - just check if any component of the path
  // matches our ignore patterns or directories
  const isIgnored = (pathToCheck: string): boolean => {
    // Get path relative to repo root for pattern matching
    const relativePath = path.relative(repoRoot, pathToCheck);
    const pathParts = relativePath.split(path.sep);

    // Check if any part of the path matches the always-ignore directories
    if (pathParts.some((part: string) => alwaysIgnoreDirs.includes(part))) {
      return true;
    }

    // Check against ignore patterns
    for (const pattern of ignorePatterns) {
      // Handle simple directory names (like 'node_modules')
      if (pathParts.includes(pattern.replace(/\/$/, ""))) {
        return true;
      }

      // Handle patterns with wildcards
      if (pattern.includes("*")) {
        const regexString = pattern
          .replace(/\./g, "\\.")
          .replace(/\*\*/g, ".*")
          .replace(/\*/g, "[^/]*");

        const regex = new RegExp(`^${regexString}$`);

        // Check each part of the path
        if (pathParts.some((part: string) => regex.test(part))) {
          return true;
        }

        // Check the full path
        if (regex.test(relativePath)) {
          return true;
        }
      }
    }

    return false;
  };

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

  // For tree building, we'll use a recursive function to traverse directories
  const fileTreeLines: string[] = [];
  const pathToSourceCode: Record<string, string> = {};

  // Recursive function to build the file tree
  const processDirectory = async (dirPath: string, depth = 0): Promise<void> => {
    if (depth > MAX_DEPTH) return;

    // Skip this directory if it's in our ignore list
    if (isIgnored(dirPath)) {
      return;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        // Skip if this entry should be ignored
        if (isIgnored(entryPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          fileTreeLines.push(`${" ".repeat(depth * 2)}${entry.name}/`);
          await processDirectory(entryPath, depth + 1);
        } else {
          fileTreeLines.push(`${" ".repeat(depth * 2)}${entry.name}`);
        }
      }
    } catch (error) {
      logger.error(`Error reading directory ${dirPath}: ${error}`);
    }
  };

  // Start processing from the root directory
  await processDirectory(directory);

  // Collect file contents for files with allowed extensions
  for (const filePath of filePaths) {
    try {
      const fullPath = path.join(directory, filePath);
      const relativePath = path.relative(repoRoot, fullPath);

      // Skip ignored files
      if (isIgnored(fullPath)) {
        continue;
      }

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
