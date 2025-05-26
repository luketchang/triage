import { DatadogTracesClient } from "./clients/datadog";
import { GrafanaTracesClient } from "./clients/grafana";
import { ObservabilityConfig } from "../config";
import { TracesClient } from "./traces.interface";

export function getTracesClient(observabilityCfg: ObservabilityConfig): TracesClient {
  if (observabilityCfg.observabilityClient === "datadog") {
    if (!observabilityCfg.datadog) {
      throw new Error("Datadog client not configured");
    }
    return new DatadogTracesClient(observabilityCfg.datadog);
  } else if (observabilityCfg.observabilityClient === "grafana") {
    if (!observabilityCfg.grafana) {
      throw new Error("Grafana client not configured");
    }
    return new GrafanaTracesClient(observabilityCfg.grafana);
  }
  throw new Error("No traces client configured");
}
