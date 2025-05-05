function filepathToGitHubUrl(repoUrl: string, filePath: string): string {
  // Normalize trailing slash on repo URL
  const repo = repoUrl.replace(/\/$/, "");
  const cleanPath = filePath.replace(/^\/+/, ""); // Remove leading slashes

  return `${repo}/blob/main/${cleanPath}`;
}
