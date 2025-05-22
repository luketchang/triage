import type { RetrieveSentryEventInput, SentryEvent, SentryListEvent } from "./types";

// Define a type for dynamic Sentry data structures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SentryDataRecord = Record<string, any>;

/**
 * Format a Sentry event for display with optional input query information
 * @param event The Sentry event to format
 * @param input Optional input parameters used to retrieve the event
 * @returns Formatted string representation of the Sentry event
 */
export function formatSentryEvent(event: SentryEvent, input?: RetrieveSentryEventInput): string {
  const parts: string[] = [];

  // Add query information if input is provided
  if (input) {
    parts.push(
      `Query: Issue ID ${input.issueId}${input.eventSpecifier ? `, Event ID ${input.eventSpecifier}` : ""}`
    );
  }

  // Basic information
  parts.push(`Event ID: ${event.eventID}`);
  parts.push(`Group ID: ${event.groupID}`);
  parts.push(`Project ID: ${event.projectID}`);
  parts.push(`Date Created: ${event.dateCreated}`);
  parts.push(`Date Received: ${event.dateReceived || "(not provided)"}`);
  parts.push(`Title: ${event.title}`);
  parts.push(`Message: ${event.message || "(no message)"}`);
  parts.push(`Platform: ${event.platform}`);
  parts.push(`Culprit: ${event.culprit || "(not provided)"}`);

  // User information
  if (event.user) {
    parts.push("\nUser:");
    parts.push(`  ID: ${event.user.id || "(anonymous)"}`);
    parts.push(`  Email: ${event.user.email || "(not provided)"}`);
    parts.push(`  Username: ${event.user.username || "(not provided)"}`);
    parts.push(`  Name: ${event.user.name || "(not provided)"}`);

    if (event.user.geo) {
      parts.push("  Geo:");
      Object.entries(event.user.geo).forEach(([key, value]) => {
        parts.push(`    ${key}: ${value}`);
      });
    }

    if (event.user.data && Object.keys(event.user.data).length > 0) {
      parts.push("  Data:");
      Object.entries(event.user.data).forEach(([key, value]) => {
        parts.push(`    ${key}: ${JSON.stringify(value)}`);
      });
    }
  }

  // Tags
  if (event.tags && event.tags.length > 0) {
    parts.push("\nTags:");
    event.tags.forEach((tag: { key: string; value: string; query?: string }) => {
      parts.push(`  ${tag.key}: ${tag.value}${tag.query ? ` (query: ${tag.query})` : ""}`);
    });
  }

  // Contexts
  if (event.contexts && Object.keys(event.contexts).length > 0) {
    parts.push("\nContexts:");
    Object.entries(event.contexts).forEach(([key, value]) => {
      parts.push(`  ${key}:`);
      if (typeof value === "object" && value !== null) {
        Object.entries(value as Record<string, unknown>).forEach(([subKey, subValue]) => {
          parts.push(`    ${subKey}: ${JSON.stringify(subValue)}`);
        });
      } else {
        parts.push(`    ${JSON.stringify(value)}`);
      }
    });
  }

  // Context (additional data)
  if (event.context && Object.keys(event.context).length > 0) {
    parts.push("\nContext:");
    Object.entries(event.context).forEach(([key, value]) => {
      parts.push(`  ${key}: ${JSON.stringify(value)}`);
    });
  }

  // Entries (including breadcrumbs, requests, etc.)
  if (event.entries && event.entries.length > 0) {
    parts.push("\nEntries:");
    // Cast entries to SentryDataRecord[] to ensure type safety
    (event.entries as SentryDataRecord[]).forEach((entry: SentryDataRecord, index: number) => {
      parts.push(`  [${index + 1}] Type: ${entry.type}`);

      // Handle different entry types
      if (entry.type === "breadcrumbs" && entry.data?.values) {
        parts.push("    Breadcrumbs:");
        entry.data.values.forEach((crumb: SentryDataRecord, crumbIndex: number) => {
          parts.push(
            `      [${crumbIndex + 1}] ${crumb.timestamp} | ${crumb.level} | ${crumb.category}: ${crumb.message}`
          );
          if (crumb.data && Object.keys(crumb.data).length > 0) {
            parts.push(`        Data: ${JSON.stringify(crumb.data)}`);
          }
        });
      } else if (entry.type === "message" && entry.data) {
        parts.push(`    Message: ${entry.data.message || ""}`);
        parts.push(`    Formatted: ${entry.data.formatted || ""}`);
        if (entry.data.params) {
          parts.push(`    Params: ${JSON.stringify(entry.data.params)}`);
        }
      } else if (entry.type === "request" && entry.data) {
        parts.push("    Request:");
        parts.push(`      URL: ${entry.data.url || ""}`);
        parts.push(`      Method: ${entry.data.method || ""}`);
        if (entry.data.headers && entry.data.headers.length > 0) {
          parts.push("      Headers:");
          entry.data.headers.forEach((header: [string, string]) => {
            parts.push(`        ${header[0]}: ${header[1]}`);
          });
        }
      } else if (entry.type === "exception" && entry.data?.values) {
        parts.push("    Exception stack trace:");
        entry.data.values.forEach((ex: SentryDataRecord) => {
          if (ex.stacktrace?.frames) {
            ex.stacktrace.frames.forEach((frame: SentryDataRecord) => {
              const fn = frame.function || "<unknown>";
              const file = frame.filename || frame.absPath || "<unknown>";
              const line = frame.lineNo != null ? frame.lineNo : "?";
              parts.push(`      at ${fn} (${file}:${line})`);
              // Print the surrounding source lines
              if (frame.context && Array.isArray(frame.context)) {
                frame.context.forEach(([ctxLineNo, ctxLine]: [number, string]) => {
                  // Trim trailing whitespace so the output stays neat
                  const trimmed = ctxLine.trimEnd();
                  parts.push(`         ${ctxLineNo}: ${trimmed}`);
                });
              }
            });
          }
        });
      } else {
        // For other types, show generic data
        parts.push(`    Data: ${JSON.stringify(entry.data, null, 2)}`);
      }
    });
  }

  // SDK information
  if (event.sdk) {
    parts.push("\nSDK:");
    Object.entries(event.sdk).forEach(([key, value]) => {
      parts.push(`  ${key}: ${value}`);
    });
  }

  // Packages
  if (event.packages && Object.keys(event.packages).length > 0) {
    const packageCount = Object.keys(event.packages).length;
    parts.push(`\nPackages (${packageCount} total):`);
    
    // Show packages (limited to reduce verbosity)
    const packagesToShow = Object.entries(event.packages).slice(0, 10);
    packagesToShow.forEach(([name, version]) => {
      parts.push(`  ${name}: ${version}`);
    });

    if (packageCount > 10) {
      parts.push(`  ... and ${packageCount - 10} more packages`);
    }
  }

  // Fingerprints
  if (event.fingerprints && event.fingerprints.length > 0) {
    parts.push("\nFingerprints:");
    event.fingerprints.forEach((fingerprint: string) => {
      parts.push(`  ${fingerprint}`);
    });
  }

  return parts.join("\n");
}

/**
 * Format a list of Sentry events for display
 * @param events Array of Sentry list events to format
 * @returns Formatted string representation of the event list
 */
export function formatSentryEventList(events: SentryListEvent[]): string {
  const parts: string[] = [];
  
  parts.push(`EVENT LIST (${events.length} events found):`);

  if (events.length === 0) {
    parts.push("No events found for this issue.");
    return parts.join("\n");
  }

  events.forEach((event, index) => {
    parts.push(`[${index + 1}] ${event.eventID} | ${event.dateCreated} | ${event.title}`);
  });

  return parts.join("\n");
}
