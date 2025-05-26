import { DatadogLogsClient } from "./clients/datadog";
import { GrafanaLogsClient } from "./clients/grafana";
import { ObservabilityConfig } from "../config";
import { LogsClient } from "./logs.interface";

export function getLogsClient(observabilityCfg: ObservabilityConfig): LogsClient {
  if (observabilityCfg.observabilityClient === "datadog") {
    if (!observabilityCfg.datadog) {
      throw new Error("Datadog client not configured");
    }
    return new DatadogLogsClient(observabilityCfg.datadog);
  } else if (observabilityCfg.observabilityClient === "grafana") {
    if (!observabilityCfg.grafana) {
      throw new Error("Grafana client not configured");
    }
    return new GrafanaLogsClient(observabilityCfg.grafana);
  }
  throw new Error("No logs client configured");
}
