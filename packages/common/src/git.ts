import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

/**
 * Get the Git remote URL for a repository
 */
export async function getGitRemoteUrl(repoPath: string): Promise<string> {
  const { stdout } = await execPromise(`cd "${repoPath}" && git remote get-url origin`);
  let gitRemoteUrl = stdout.trim();

  // Remove .git suffix if present
  if (gitRemoteUrl.endsWith(".git")) {
    gitRemoteUrl = gitRemoteUrl.slice(0, -4);
  }

  // Convert SSH URL to HTTPS URL if needed
  if (gitRemoteUrl.startsWith("git@github.com:")) {
    // Convert SSH URL format (git@github.com:user/repo.git) to HTTPS format
    gitRemoteUrl = gitRemoteUrl.replace(/^git@github\.com:/, "https://github.com/");
  }

  return gitRemoteUrl;
}

/**
 * Get the current Git commit hash for a repository
 */
export async function getGitCommitHash(repoPath: string): Promise<string> {
  const { stdout } = await execPromise(`cd "${repoPath}" && git rev-parse HEAD`);
  return stdout.trim();
}
