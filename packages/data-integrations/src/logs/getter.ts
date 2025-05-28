import { DataIntegrationsConfig } from "../config";
import { DatadogLogsClient } from "./clients/datadog";
import { GrafanaLogsClient } from "./clients/grafana";
import { GcloudLogsClient } from "./clients/gcloud";
import { LogsClient } from "./logs.interface";

export function getLogsClient(dataIntegrationsCfg: DataIntegrationsConfig): LogsClient {
  if (dataIntegrationsCfg.logsProvider === "datadog") {
    if (!dataIntegrationsCfg.datadog) {
      throw new Error("Datadog client not configured");
    }
    return new DatadogLogsClient(dataIntegrationsCfg.datadog);
  } else if (dataIntegrationsCfg.logsProvider === "grafana") {
    if (!dataIntegrationsCfg.grafana) {
      throw new Error("Grafana client not configured");
    }
    return new GrafanaLogsClient(dataIntegrationsCfg.grafana);
  } else if (dataIntegrationsCfg.logsProvider === "gcloud") {
    if (!dataIntegrationsCfg.gcloud) {
      throw new Error("Google Cloud client not configured");
    }
    return new GcloudLogsClient(dataIntegrationsCfg.gcloud);
  }
  throw new Error("No logs client configured");
}
