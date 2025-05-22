import { logger } from "@triage/common";
import {
  RetrieveSentryEventInput,
  SentryClient,
  SentryConfigStore,
  SentryEvent,
} from "@triage/data-integrations";
import { ipcMain } from "electron";
import { registerHandler } from "./register-util.js";

/**
 * Set up all IPC handlers related to Sentry
 */
export function setupSentryHandlers(sentryCfgStore: SentryConfigStore): void {
  logger.info("Setting up Sentry handlers...");

  // Fetch Sentry event by specifier
  registerHandler(
    "sentry:fetch-event",
    async (_event: any, params: RetrieveSentryEventInput): Promise<SentryEvent> => {
      try {
        const sentryCfg = await sentryCfgStore.getValues();

        if (!sentryCfg.sentry?.authToken) {
          throw new Error("Sentry auth token not configured");
        }

        const client = new SentryClient(sentryCfg.sentry.authToken);

        // Call the client API to fetch the event
        logger.info(`Fetching Sentry event for org ${params.orgSlug}, issue ${params.issueId}`);
        const result = await client.getEventForIssue(
          params.orgSlug,
          params.issueId,
          params.eventSpecifier
        );

        return result;
      } catch (error) {
        logger.error("Error fetching Sentry event:", error);
        throw error;
      }
    }
  );

  logger.info("All Sentry handlers registered.");
}

/**
 * Clean up resources used by Sentry handlers
 */
export function cleanupSentryHandlers(): void {
  // Remove all handlers
  ipcMain.removeHandler("sentry:fetch-event");

  logger.info("Sentry handlers cleanup complete.");
}
