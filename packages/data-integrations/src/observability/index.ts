export * from "./config";
export * from "./observability.interface";
export * from "./types";

// Export clients
export { DatadogClient } from "./clients/datadog";
export { GrafanaClient } from "./clients/grafana";

// Export getter
export { getObservabilityClient } from "./getter";
