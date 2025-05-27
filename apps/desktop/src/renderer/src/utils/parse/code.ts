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

export function absoluteToRepoRelativePath(
  repoBasePath: string,
  filePath: string
): string | undefined {
  const normalize = (p: string) =>
    p
      .replace(/\\/g, "/") // backslashes → forward
      .replace(/\/+$/, ""); // drop trailing slash(es)

  const repo = normalize(repoBasePath);
  const fp = normalize(filePath);

  if (fp === repo) {
    return "";
  }

  const prefix = repo + "/";

  if (!fp.startsWith(prefix)) {
    // Return null instead of throwing an error when path is not inside repository
    return undefined;
  }

  return fp.slice(prefix.length);
}
