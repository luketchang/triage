import { logger } from "@triage/common";
import axios, { AxiosInstance } from "axios";
import { SentryEvent, SentryListEvent } from "./types";

/**
 * A low-level Sentry client.  Constructor only needs an API token.
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
   * Retrieve one event by its exact event ID.
   */
  async retrieveIssueEvent(
    orgSlug: string,
    issueId: string,
    eventId: string
  ): Promise<SentryEvent> {
    const url = `/${encodeURIComponent(orgSlug)}/issues/${encodeURIComponent(
      issueId
    )}/events/${encodeURIComponent(eventId)}/`;
    logger.info(`GET ${url}`);
    const resp = await this.axios.get<SentryEvent>(url);
    return resp.data;
  }

  /**
   * List *all* events on an issue (newest first).
   */
  async listIssueEvents(orgSlug: string, issueId: string): Promise<SentryListEvent[]> {
    const url = `/${encodeURIComponent(orgSlug)}/issues/${encodeURIComponent(issueId)}/events/`;
    logger.info(`GET ${url}`);
    const resp = await this.axios.get<SentryListEvent[]>(url);
    return resp.data;
  }

  /**
   * Given an eventSpecifier which is either
   * - a concrete event ID (32-hex), or
   * - "latest" | "oldest" | "recommended",
   *
   * returns the full `SentryEvent`.  (Note: "recommended" defaults to newest.)
   */
  async fetchEventBySpecifier(
    orgSlug: string,
    issueId: string,
    eventSpecifier: string
  ): Promise<SentryEvent> {
    const isKeyword =
      eventSpecifier === "latest" ||
      eventSpecifier === "oldest" ||
      eventSpecifier === "recommended";

    if (!isKeyword) {
      return this.retrieveIssueEvent(orgSlug, issueId, eventSpecifier);
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
    return this.retrieveIssueEvent(orgSlug, issueId, chosenId);
  }
}
