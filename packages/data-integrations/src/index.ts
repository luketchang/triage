// Export the new unified config
export {
  DatadogCfgSchema,
  DataIntegrationsCfgSchema,
  DataIntegrationsConfigStore,
  GrafanaCfgSchema,
  SentryInternalCfgSchema,
} from "./config";
export type { DatadogConfig, DataIntegrationsConfig, GrafanaConfig } from "./config";

// Export specific clients and getters from logs and traces
export { DatadogLogsClient, getLogsClient, GrafanaLogsClient } from "./logs";
export { DatadogTracesClient, getTracesClient, GrafanaTracesClient } from "./traces";

// Export types and interfaces from logs and traces (avoiding duplicates)
export type { Log, LogSearchInput, LogsWithPagination } from "./logs/types";

export type { LogsClient } from "./logs/logs.interface";

export type {
  DisplaySpan,
  DisplayTrace,
  ServiceLatency,
  Span,
  SpanError,
  SpanSearchInput,
  SpansWithPagination,
  Trace,
  TraceSearchInput,
  TracesWithPagination,
} from "./traces/types";

export type { TracesClient } from "./traces/traces.interface";

// Export shared enums (only once)
export { IntegrationType, PaginationStatus } from "./logs/types";

// Export sentry client and types
export { SentryClient } from "./sentry";
export type { GetSentryEventInput, SentryEvent, SentryEventSpecifier } from "./sentry";

// Export formatting functions
export { formatLogQuery, formatSingleLog } from "./logs/formatting";
export { formatSentryEvent } from "./sentry";
export { formatSpans, formatTraces } from "./traces/formatting";

// Export legacy observability client interface for backward compatibility
export type { LogsClient as ObservabilityClient } from "./logs/logs.interface";

// Export legacy getter function for backward compatibility
export { getLogsClient as getObservabilityClient } from "./logs";
