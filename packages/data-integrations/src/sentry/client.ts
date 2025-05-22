/*
 * Sentry URLs and Event Specifiers
 *
 * The Sentry UI allows users to select events on an issue page in several ways:
 *   - By clicking "latest", "oldest", or "recommended" buttons, which update the URL with the corresponding specifier.
 *   - By selecting a specific event, in which case the event ID appears in the URL.
 *   - By not selecting anything (default on page load), in which case "recommended" is used internally, but not shown in the URL.
 *
 * This API supports both event specifiers ("latest", "oldest", "recommended") and concrete event IDs to match all possible Sentry URL cases.
 *
 * Note on "recommended":
 *   - Sentry's "recommended" event is not always guaranteed to be the same as "latest", but in practice, they almost always match.
 *   - We unfortunately don't have access to figuring out which event is the "recommended" event, so we treat "recommended" as "latest" for now. NOTE: this is a hack due to API limitations and may not be 100% accurate.
 *   - If Sentry changes their logic or exposes a true "recommended" API, this should be revisited.
 */

import { logger } from "@triage/common";
import axios, { AxiosInstance } from "axios";

import { RetrieveSentryEventInput, SentryEvent, SentryListEvent } from "./types";

/**
 * A low-level Sentry client. Constructor only needs an API token.
 * Methods all require you to pass in the orgSlug and issueId.
 */
export class SentryClient {
  private readonly axios: AxiosInstance;
  private readonly basePath = "/api/0";

  constructor(authToken: string) {
    this.axios = axios.create({
      baseURL: `https://sentry.io${this.basePath}`,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get an event for a specific issue. If no eventSpecifier is provided, returns the latest event.
   *
   * @param orgSlug Organization slug
   * @param issueId Issue ID
   * @param eventSpecifier Optional event ID or specifier ("latest", "oldest", "recommended")
   * @returns The Sentry event
   */
  async getEventForIssue({
    orgSlug,
    issueId,
    eventSpecifier = "latest",
  }: RetrieveSentryEventInput): Promise<SentryEvent> {
    const isKeyword =
      eventSpecifier === "latest" ||
      eventSpecifier === "oldest" ||
      eventSpecifier === "recommended";

    if (!isKeyword) {
      return this.getEventById(orgSlug, issueId, eventSpecifier);
    }

    const all = await this.listIssueEvents(orgSlug, issueId);
    if (all.length === 0) {
      throw new Error(`No events found for ${orgSlug}/${issueId}`);
    }

    let chosenId: string;
    if (eventSpecifier === "oldest") {
      // list is newest-first, so oldest is last element
      chosenId = all[all.length - 1]!.eventID;
    } else {
      // latest & recommended → first element
      chosenId = all[0]!.eventID;
    }

    logger.info(`Picked "${eventSpecifier}" → eventID=${chosenId} for ${orgSlug}/${issueId}`);
    return this.getEventById(orgSlug, issueId, chosenId);
  }

  /**
   * List *all* events on an issue (newest first).
   *
   * @param orgSlug Organization slug
   * @param issueId Issue ID
   * @returns List of Sentry events
   */
  async listIssueEvents(orgSlug: string, issueId: string): Promise<SentryListEvent[]> {
    const url = `/organizations/${encodeURIComponent(orgSlug)}/issues/${encodeURIComponent(issueId)}/events/`;
    logger.info(`GET ${url}`);
    const resp = await this.axios.get<SentryListEvent[]>(url);
    return resp.data;
  }

  /**
   * Get one event by its exact event ID.
   * @private Internal method to get an event by ID
   *
   * @param orgSlug Organization slug
   * @param issueId Issue ID
   * @param eventId Event ID
   * @returns The Sentry event
   */
  private async getEventById(
    orgSlug: string,
    issueId: string,
    eventId: string
  ): Promise<SentryEvent> {
    const url = `/organizations/${encodeURIComponent(orgSlug)}/issues/${encodeURIComponent(
      issueId
    )}/events/${encodeURIComponent(eventId)}/`;
    logger.info(`GET ${url}`);
    const resp = await this.axios.get<SentryEvent>(url);
    return resp.data;
  }
}
