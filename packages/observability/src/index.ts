// Export interfaces
export * from "./config";
export * from "./observability.interface";
export * from "./types";

// Export platforms
export { DatadogPlatform } from "./platforms/datadog";
export { GrafanaPlatform } from "./platforms/grafana";

// Export getter
export { getObservabilityPlatform } from "./getter";
