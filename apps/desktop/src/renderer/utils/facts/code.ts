export function filepathToGitHubUrl(repoBaseUrl: string, filePath: string): string {
  // Normalize trailing slash on repo URL
  const repo = repoBaseUrl.replace(/\/$/, "");
  const cleanPath = filePath.replace(/^\/+/, ""); // Remove leading slashes

  return `${repo}/blob/main/${cleanPath}`;
}
