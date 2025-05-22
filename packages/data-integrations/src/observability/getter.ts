import { DatadogClient } from "./clients/datadog";
import { GrafanaClient } from "./clients/grafana";
import { ObservabilityConfig } from "./config";
import { ObservabilityClient } from "./observability.interface";

export function getObservabilityClient(observabilityCfg: ObservabilityConfig): ObservabilityClient {
  if (observabilityCfg.observabilityClient === "datadog") {
    if (!observabilityCfg.datadog) {
      throw new Error("Datadog client not configured");
    }
    return new DatadogClient(observabilityCfg.datadog);
  } else if (observabilityCfg.observabilityClient === "grafana") {
    if (!observabilityCfg.grafana) {
      throw new Error("Grafana client not configured");
    }
    return new GrafanaClient(observabilityCfg.grafana);
  }
  throw new Error("No observability client configured");
}
