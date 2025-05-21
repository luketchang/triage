import { RetrieveSentryEventInput, SentryEventSpecifier } from "../../types";

/**
 * Checks if a URL is a valid Sentry event URL
 * @param url URL to check
 * @returns true if URL is a valid Sentry event URL
 */
export function isValidSentryEventUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  // Check for basic Sentry URL format
  if (!url.includes(".sentry.io/issues/")) {
    return false;
  }

  try {
    // Validate URL format
    const parsedUrl = new URL(url);

    // Check hostname
    if (!parsedUrl.hostname.includes(".sentry.io")) {
      return false;
    }

    // Check path structure
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    const issueIdx = pathParts.indexOf("issues");

    // Must have issues/{issueId} format
    if (issueIdx < 0 || pathParts.length < issueIdx + 2) {
      return false;
    }

    return true;
  } catch {
    // If URL parsing fails, it's not a valid URL
    return false;
  }
}

export function parseSentryEventUrl(fullUrl: string): RetrieveSentryEventInput {
  const u = new URL(fullUrl);

  // extract org slug from subdomain
  const hostParts = u.hostname.split(".");
  const orgSlug = hostParts[0];

  const parts = u.pathname.split("/").filter(Boolean);
  // parts: ["issues","{issueId}", maybe "events","{specifier}", …]
  const issueIdx = parts.indexOf("issues");
  if (issueIdx < 0 || parts.length < issueIdx + 2) {
    throw new Error(`Not a valid Sentry issue URL: ${fullUrl}`);
  }

  const issueId = parts[issueIdx + 1];

  let eventSpecifier: SentryEventSpecifier = "recommended";
  if (parts[issueIdx + 2] === "events") {
    // has an explicit events/… segment
    const maybeSpecifier = parts[issueIdx + 3];
    eventSpecifier = normalizeEventSpecifier(maybeSpecifier);
  }

  return { type: "retrieveSentryEventInput", orgSlug, issueId, eventSpecifier };
}

function normalizeEventSpecifier(value?: string): SentryEventSpecifier {
  if (!value) {
    return "recommended";
  }
  const kw = value.toLowerCase();
  if (kw === "latest" || kw === "oldest" || kw === "recommended") {
    return kw;
  }
  // 32-hex Sentry event IDs
  if (/^[0-9a-f]{32}$/i.test(value)) {
    return value;
  }
  return "recommended";
}
