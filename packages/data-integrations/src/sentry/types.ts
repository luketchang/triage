export type SentryEventSpecifier = "latest" | "oldest" | "recommended" | string;

export interface GetSentryEventInput {
  type: "getSentryEventInput";
  orgSlug: string;
  issueId: string;
  eventSpecifier: SentryEventSpecifier;
}

export interface SentryEvent {
  id: string;
  groupID: string | null;
  eventID: string;
  projectID: string;
  message: string | null;
  title: string;
  location: string | null;
  user: {
    id: string | null;
    email: string | null;
    username: string | null;
    ip_address: string | null;
    name: string | null;
    geo: Record<string, string> | null;
    data: Record<string, unknown> | null;
  } | null;
  tags: Array<{ key: string; value: string; query?: string }>;
  platform: string;
  dateReceived: string | null;
  contexts: Record<string, unknown> | null;
  size: number | null;
  entries: unknown[];
  dist: string | null;
  sdk: Record<string, string>;
  context: Record<string, unknown> | null;
  packages: Record<string, unknown>;
  type: string;
  metadata: unknown;
  errors: unknown[];
  occurrence: unknown;
  _meta: Record<string, unknown>;
  crashFile: string | null;
  culprit: string | null;
  dateCreated: string;
  fingerprints: string[];
  groupingConfig: unknown;
  startTimestamp: string;
  endTimestamp: string;
  measurements: unknown;
  breakdowns: unknown;
  release: unknown;
  userReport: unknown;
  sdkUpdates: unknown[];
  resolvedWith: string[];
  nextEventID: string | null;
  previousEventID: string | null;
}

export interface SentryListEvent {
  id: string;
  "event.type": string;
  groupID: string | null;
  eventID: string;
  projectID: string;
  message: string;
  title: string;
  location: string | null;
  culprit: string | null;
  user: {
    id: string | null;
    email: string | null;
    username: string | null;
    ip_address: string | null;
    name: string | null;
    geo: Record<string, string> | null;
    data: Record<string, unknown> | null;
  } | null;
  tags: Array<{ key: string; value: string; query?: string }>;
  platform: string | null;
  dateCreated: string;
  crashFile: string | null;
  metadata: Record<string, unknown> | null;
}
