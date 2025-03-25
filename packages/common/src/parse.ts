/**
 * Extracts the content between the specified XML-like tags.
 * @param text The input text to search in.
 * @param tag The tag name to look for.
 * @returns The content between the tags, or null if not found.
 */
export function extractXmlContent(text: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}>(.*?)</${tag}>`, "s");
  const match = text.match(pattern);
  return match && match[1] ? match[1].trim() : null;
}

/**
 * Extracts all occurrences of content between the specified XML-like tags.
 * @param text The input text to search in.
 * @param tag The tag name to look for.
 * @returns An array of strings containing the content between each pair of tags.
 */
export function extractXmlContents(text: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}>(.*?)</${tag}>`, "gs");
  const matches = Array.from(text.matchAll(pattern));
  return matches.map((match) => (match[1] ? match[1].trim() : "")).filter(Boolean);
}

/**
 * Parses a comma-separated string into an array of strings.
 * @param commaString The comma-separated string to parse.
 * @returns An array of strings.
 */
export function commaStringToList(commaString: string): string[] {
  return commaString.split(",").map((item) => item.trim());
}
