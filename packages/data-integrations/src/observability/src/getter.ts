import { ObservabilityConfig } from "./config";
import { ObservabilityPlatform } from "./observability.interface";
import { DatadogPlatform } from "./platforms/datadog";
import { GrafanaPlatform } from "./platforms/grafana";

export function getObservabilityPlatform(
  observabilityCfg: ObservabilityConfig
): ObservabilityPlatform {
  if (observabilityCfg.observabilityPlatform === "datadog") {
    if (!observabilityCfg.datadog) {
      throw new Error("Datadog platform not configured");
    }
    return new DatadogPlatform(observabilityCfg.datadog);
  } else if (observabilityCfg.observabilityPlatform === "grafana") {
    if (!observabilityCfg.grafana) {
      throw new Error("Grafana platform not configured");
    }
    return new GrafanaPlatform(observabilityCfg.grafana);
  }
  throw new Error("No observability platform configured");
}
