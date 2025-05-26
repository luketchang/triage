import { DataIntegrationsConfig } from "../config";
import { DatadogTracesClient } from "./clients/datadog";
import { GrafanaTracesClient } from "./clients/grafana";
import { TracesClient } from "./traces.interface";

export function getTracesClient(dataIntegrationsCfg: DataIntegrationsConfig): TracesClient {
  if (dataIntegrationsCfg.tracesProvider === "datadog") {
    if (!dataIntegrationsCfg.datadog) {
      throw new Error("Datadog client not configured");
    }
    return new DatadogTracesClient(dataIntegrationsCfg.datadog);
  } else if (dataIntegrationsCfg.tracesProvider === "grafana") {
    if (!dataIntegrationsCfg.grafana) {
      throw new Error("Grafana client not configured");
    }
    return new GrafanaTracesClient(dataIntegrationsCfg.grafana);
  }
  throw new Error("No traces client configured");
}
