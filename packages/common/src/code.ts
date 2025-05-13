import fs from "fs/promises";
import * as path from "path";

import { globby } from "globby";

export const ALLOWED_EXTENSIONS = [
  // Compiled Languages
  ".c",
  ".cpp",
  ".cc",
  ".cxx",
  ".h",
  ".hpp",
  ".hh",
  ".java",
  ".cs",
  ".go",
  ".rs",
  ".swift",
  ".kt",
  ".kts",
  ".m",
  ".mm",

  // Scripting/Interpreted Languages
  ".py",
  ".rb",
  ".pl",
  ".pm",
  ".php",
  ".js",
  ".ts",
  ".lua",
  ".sh",
  ".bash",
  ".zsh",
  ".ps1",
  ".r",
  ".jl",

  // Web Templates / UI Logic
  ".html",
  ".htm",
  ".jsx",
  ".tsx",
  ".vue",

  // Functional & Other Languages
  ".hs",
  ".clj",
  ".cljs",
  ".cljc",
  ".scala",
  ".dart",
  ".erl",
  ".ex",
  ".exs",

  // Documentation
  ".md",
];

export const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Creates a string representation of the file tree starting at the given
 * directory, respecting .gitignore patterns.
 *
 * @param directory - The base directory to read from
 * @param allowedExtensions - An array of file extensions to include in the tree
 * (useful for excluding certain types of files like build artifacts).
 * @returns A string representation of the file tree, with each level of the tree
 * indented with two spaces.
 */
export async function getDirectoryTree(
  directory: string,
  allowedExtensions: string[] = ALLOWED_EXTENSIONS
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
    globby(allowedExtensions.length > 0 ? allowedExtensions.map((ext) => `**/*${ext}`) : ["**/*"], {
      cwd: directory,
      onlyFiles: true,
      dot: true,
      absolute: false,
      followSymbolicLinks: false,
      gitignore: true,
      ignore: [".git"],
    }),
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
export async function getPathToSourceCodeMap(
  directory: string,
  repoRoot: string,
  allowedExtensions: string[] = ALLOWED_EXTENSIONS,
  maxFileSize: number = MAX_FILE_SIZE
): Promise<Record<string, string>> {
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

      if (stats.size <= maxFileSize) {
        const content = await fs.readFile(fullPath, "utf-8");
        pathToSourceCode[relativePath] = content;
      } else {
        pathToSourceCode[relativePath] = `File too large to include (${stats.size} bytes)`;
      }
    } catch (error) {
      console.error(`Error reading file ${filePath}: ${error}`);
    }
  }

  return pathToSourceCode;
}
