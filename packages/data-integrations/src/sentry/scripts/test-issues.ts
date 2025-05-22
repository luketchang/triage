#!/usr/bin/env tsx
import { logger } from "@triage/common";
import { Command } from "commander";

import { SentryClient } from "../";
import { SentryEvent, SentryListEvent } from "../types";

// Setup command line options
const program = new Command();

program
  .name("test-issues")
  .description("Test Sentry client issue fetching capabilities")
  .requiredOption("-o, --org-slug <orgSlug>", "Sentry organization slug")
  .requiredOption("-i, --issue-id <issueId>", "Sentry issue ID")
  .option("-e, --event-id <eventId>", "Specific event ID to fetch (optional)")
  .option(
    "-s, --event-specifier <specifier>",
    "Event specifier (latest, oldest, recommended, or concrete event ID)",
    "latest"
  )
  .option("-l, --list-events", "List all events for the issue", false)
  .option("-p, --show-packages", "Show all packages in the event", false)
  .parse(process.argv);

const options = program.opts();

// Display single event details
function displayEvent(event: SentryEvent, title: string, showAllPackages = false): void {
  logger.info(`\n${title}:`);
  logger.info(`Event ID: ${event.eventID}`);
  logger.info(`Group ID: ${event.groupID}`);
  logger.info(`Project ID: ${event.projectID}`);
  logger.info(`Date Created: ${event.dateCreated}`);
  logger.info(`Date Received: ${event.dateReceived || "(not provided)"}`);
  logger.info(`Title: ${event.title}`);
  logger.info(`Message: ${event.message || "(no message)"}`);
  logger.info(`Platform: ${event.platform}`);
  logger.info(`Culprit: ${event.culprit || "(not provided)"}`);
  logger.info(`Size: ${event.size || "(not provided)"}`);

  // User information
  if (event.user) {
    logger.info("\nUser:");
    logger.info(`  ID: ${event.user.id || "(anonymous)"}`);
    logger.info(`  Email: ${event.user.email || "(not provided)"}`);
    logger.info(`  Username: ${event.user.username || "(not provided)"}`);
    logger.info(`  Name: ${event.user.name || "(not provided)"}`);

    if (event.user.geo) {
      logger.info("  Geo:");
      Object.entries(event.user.geo).forEach(([key, value]) => {
        logger.info(`    ${key}: ${value}`);
      });
    }

    if (event.user.data && Object.keys(event.user.data).length > 0) {
      logger.info("  Data:");
      logger.info(`    ${JSON.stringify(event.user.data, null, 2)}`);
    }
  }

  // Tags
  if (event.tags && event.tags.length > 0) {
    logger.info("\nTags:");
    event.tags.forEach((tag: { key: string; value: string; query?: string }) => {
      logger.info(`  ${tag.key}: ${tag.value}${tag.query ? ` (query: ${tag.query})` : ""}`);
    });
  }

  // Contexts
  if (event.contexts && Object.keys(event.contexts).length > 0) {
    logger.info("\nContexts:");
    Object.entries(event.contexts).forEach(([key, value]) => {
      logger.info(`  ${key}:`);
      if (typeof value === "object" && value !== null) {
        Object.entries(value as Record<string, unknown>).forEach(([subKey, subValue]) => {
          logger.info(`    ${subKey}: ${JSON.stringify(subValue)}`);
        });
      } else {
        logger.info(`    ${JSON.stringify(value)}`);
      }
    });
  }

  // Context (additional data)
  if (event.context && Object.keys(event.context).length > 0) {
    logger.info("\nContext:");
    Object.entries(event.context).forEach(([key, value]) => {
      logger.info(`  ${key}: ${JSON.stringify(value)}`);
    });
  }

  // Entries (including breadcrumbs, requests, etc.)
  if (event.entries && event.entries.length > 0) {
    logger.info("\nEntries:");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event.entries.forEach((entry: any, index: number) => {
      logger.info(`  [${index + 1}] Type: ${entry.type}`);

      // Handle different entry types
      if (entry.type === "breadcrumbs" && entry.data?.values) {
        logger.info("    Breadcrumbs:");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entry.data.values.forEach((crumb: any, crumbIndex: number) => {
          logger.info(
            `      [${crumbIndex + 1}] ${crumb.timestamp} | ${crumb.level} | ${crumb.category}: ${crumb.message}`
          );
          if (crumb.data && Object.keys(crumb.data).length > 0) {
            logger.info(`        Data: ${JSON.stringify(crumb.data)}`);
          }
        });
      } else if (entry.type === "message" && entry.data) {
        logger.info(`    Message: ${entry.data.message || ""}`);
        logger.info(`    Formatted: ${entry.data.formatted || ""}`);
        if (entry.data.params) {
          logger.info(`    Params: ${JSON.stringify(entry.data.params)}`);
        }
      } else if (entry.type === "request" && entry.data) {
        logger.info("    Request:");
        logger.info(`      URL: ${entry.data.url || ""}`);
        logger.info(`      Method: ${entry.data.method || ""}`);
        if (entry.data.headers && entry.data.headers.length > 0) {
          logger.info("      Headers:");
          entry.data.headers.forEach((header: [string, string]) => {
            logger.info(`        ${header[0]}: ${header[1]}`);
          });
        }
      } else {
        // For other types, show generic data
        logger.info(`    Data: ${JSON.stringify(entry.data, null, 2)}`);
      }
    });
  }

  // SDK information
  if (event.sdk) {
    logger.info("\nSDK:");
    Object.entries(event.sdk).forEach(([key, value]) => {
      logger.info(`  ${key}: ${value}`);
    });
  }

  // Packages (truncated if too many)
  if (event.packages && Object.keys(event.packages).length > 0) {
    const packageCount = Object.keys(event.packages).length;
    logger.info(`\nPackages (${packageCount} total):`);

    // Show all packages or just the first 10
    const packagesToShow = showAllPackages
      ? Object.entries(event.packages)
      : Object.entries(event.packages).slice(0, 10);

    packagesToShow.forEach(([name, version]) => {
      logger.info(`  ${name}: ${version}`);
    });

    if (!showAllPackages && packageCount > 10) {
      logger.info(`  ... and ${packageCount - 10} more packages`);
      logger.info("  (Use --show-packages flag to see all packages)");
    }
  }

  // Fingerprints
  if (event.fingerprints && event.fingerprints.length > 0) {
    logger.info("\nFingerprints:");
    event.fingerprints.forEach((fingerprint) => {
      logger.info(`  ${fingerprint}`);
    });
  }
}

// Display list of events
function displayEventList(events: SentryListEvent[]): void {
  logger.info(`\nEVENT LIST (${events.length} events found):`);

  if (events.length === 0) {
    logger.info("No events found for this issue.");
    return;
  }

  events.forEach((event, index) => {
    logger.info(`[${index + 1}] ${event.eventID} | ${event.dateCreated} | ${event.title}`);
  });
}

async function main(): Promise<void> {
  logger.info("Starting Sentry issues test...");

  // Check for Sentry auth token
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  if (!authToken) {
    logger.error("SENTRY_AUTH_TOKEN environment variable is required");
    throw new Error("SENTRY_AUTH_TOKEN environment variable is required");
  }

  const { orgSlug, issueId, eventId, eventSpecifier, listEvents, showPackages } = options;

  try {
    const sentryClient = new SentryClient(authToken);

    // List all events if requested
    if (listEvents) {
      logger.info(`Fetching all events for issue ${issueId}...`);
      const events = await sentryClient.listIssueEvents(orgSlug, issueId);
      displayEventList(events);
    }

    // Get event details - either by specific ID or using a specifier
    if (!listEvents || eventId || eventSpecifier !== "latest") {
      // If we have a specific eventId, use that, otherwise use the specifier
      const idToUse = eventId || eventSpecifier;
      logger.info(`Fetching event (${idToUse}) for issue ${issueId}...`);

      const event = await sentryClient.getEventForIssue(orgSlug, issueId, idToUse);

      const title = eventId
        ? `EVENT DETAILS FOR ${eventId}`
        : `${eventSpecifier.toUpperCase()} EVENT DETAILS`;

      displayEvent(event, title, showPackages);
    }

    logger.info("\nSentry issues test completed!");
  } catch (error) {
    logger.error("Error testing Sentry client:", error);
    throw error;
  }
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  throw error;
});
