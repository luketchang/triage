import { DatadogPlatform } from "./datadog.platform";
import { GrafanaPlatform } from "./grafana.platform";
import { ObservabilityPlatform } from "./observability.interface";
import { IntegrationType } from "./types";

export function getObservabilityPlatform(integrationType: IntegrationType): ObservabilityPlatform {
  switch (integrationType) {
    case IntegrationType.DATADOG:
      return new DatadogPlatform();
    case IntegrationType.GRAFANA:
      return new GrafanaPlatform();
  }
}
