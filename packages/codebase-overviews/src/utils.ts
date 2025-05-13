import path from "path";

import { globby } from "globby";

// Get top-level directories that aren't ignored. Returns list of absolute paths
export async function getTopLevelDirectories(repoPath: string): Promise<string[]> {
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
}
