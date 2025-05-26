import { DataIntegrationsConfig } from "../config";
import { DatadogLogsClient } from "./clients/datadog";
import { GrafanaLogsClient } from "./clients/grafana";
import { LogsClient } from "./logs.interface";

export function getLogsClient(dataIntegrationsCfg: DataIntegrationsConfig): LogsClient {
  if (dataIntegrationsCfg.observabilityClient === "datadog") {
    if (!dataIntegrationsCfg.datadog) {
      throw new Error("Datadog client not configured");
    }
    return new DatadogLogsClient(dataIntegrationsCfg.datadog);
  } else if (dataIntegrationsCfg.observabilityClient === "grafana") {
    if (!dataIntegrationsCfg.grafana) {
      throw new Error("Grafana client not configured");
    }
    return new GrafanaLogsClient(dataIntegrationsCfg.grafana);
  }
  throw new Error("No logs client configured");
}
