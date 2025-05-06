export function filepathToGitHubUrl(
  repoBaseUrl: string,
  filePath: string,
  lineNumbers?: { startLine: number; endLine: number }
): string {
  // Normalize trailing slash on repo URL
  const repo = repoBaseUrl.replace(/\/$/, "");
  const cleanPath = filePath.replace(/^\/+/, ""); // Remove leading slashes

  let url = `${repo}/blob/main/${cleanPath}`;

  if (lineNumbers) {
    const { startLine, endLine } = lineNumbers;
    if (startLine === endLine) {
      url += `#L${startLine}`;
    } else {
      url += `#L${startLine}-L${endLine}`;
    }
  }

  return url;
}
