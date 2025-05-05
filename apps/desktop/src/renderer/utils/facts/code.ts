export function filepathToGitHubUrl(repoBaseUrl: string, filePath: string): string {
  // Normalize trailing slash on repo URL
  const repo = repoBaseUrl.replace(/\/$/, "");
  const cleanPath = filePath.replace(/^\/+/, ""); // Remove leading slashes

  return `${repo}/blob/main/${cleanPath}`;
}

// Browser-compatible path normalization function
export function normalizeFilePath(filePath: string, repoPath: string): string {
  // Ensure paths use consistent separators
  const normalizedFilePath = filePath.replace(/\\/g, "/");
  const normalizedRepoPath = repoPath.replace(/\\/g, "/");

  // If file path starts with repo path, remove it to get the relative path
  if (normalizedFilePath.startsWith(normalizedRepoPath)) {
    // Remove repo path and any leading slashes
    return normalizedFilePath.slice(normalizedRepoPath.length).replace(/^\/+/, "");
  }

  // If file path doesn't start with repo path, it might already be relative
  return normalizedFilePath.replace(/^\/+/, "");
}
