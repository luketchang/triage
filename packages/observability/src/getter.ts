import { ObservabilityPlatform } from "./observability.interface";
import { DatadogPlatform } from "./platforms/datadog";
import { GrafanaPlatform } from "./platforms/grafana";
import { IntegrationType } from "./types";

export function getObservabilityPlatform(integrationType: IntegrationType): ObservabilityPlatform {
  switch (integrationType) {
    case IntegrationType.DATADOG:
      return new DatadogPlatform();
    case IntegrationType.GRAFANA:
      return new GrafanaPlatform();
    default:
      throw new Error(`Unsupported integration type: ${integrationType}`);
  }
}
