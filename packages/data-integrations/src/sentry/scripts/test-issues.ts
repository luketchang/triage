#!/usr/bin/env tsx
import { logger } from "@triage/common";
import { Command } from "commander";

import { SentryClient, formatSentryEvent, formatSentryEventList,} from "../";
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
  // Use the formatSentryEvent function for consistent formatting
  const formattedEvent = formatSentryEvent(event);
  logger.info(`\n${title}:`);
  logger.info(formattedEvent);

  // Add note about packages if needed
  if (event.packages && Object.keys(event.packages).length > 10 && !showAllPackages) {
    logger.info("  (Use --show-packages flag to see all packages)");
  }
}

// Display list of events
function displayEventList(events: SentryListEvent[]): void {
  // Use the formatSentryEventList function for consistent formatting
  const formattedList = formatSentryEventList(events);
  logger.info(`\n${formattedList}`);
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

      const event = await sentryClient.getEventForIssue({
        type: "getSentryEventInput",
        orgSlug,
        issueId,
        eventSpecifier: idToUse,
      });

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
