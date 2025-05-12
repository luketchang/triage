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
