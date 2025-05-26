import { configSecret, ConfigStore, DelegatingConfigStore } from "@triage/config";
import { z } from "zod";

export const DatadogCfgSchema = z.object({
  apiKey: configSecret(z.string()),
  appKey: configSecret(z.string()),
  site: z.string().default("datadoghq.com"),
});
export type DatadogConfig = z.infer<typeof DatadogCfgSchema>;

export const GrafanaCfgSchema = z.object({
  baseUrl: z.string(),
  username: z.string(),
  password: configSecret(z.string()),
});
export type GrafanaConfig = z.infer<typeof GrafanaCfgSchema>;

export const SentryInternalCfgSchema = z.object({
  authToken: configSecret(z.string()),
});

export const DataIntegrationsCfgSchema = z.object({
  observabilityClient: z.enum(["datadog", "grafana"]).default("datadog"),
  observabilityFeatures: z.array(z.enum(["logs", "spans"])).default(["logs"]),
  datadog: DatadogCfgSchema.optional(),
  grafana: GrafanaCfgSchema.optional(),
  sentry: SentryInternalCfgSchema.optional(),
});
export type DataIntegrationsConfig = z.infer<typeof DataIntegrationsCfgSchema>;

export class DataIntegrationsConfigStore extends DelegatingConfigStore<DataIntegrationsConfig> {
  constructor(parentStore: ConfigStore<DataIntegrationsConfig>) {
    super(parentStore, DataIntegrationsCfgSchema);
  }
}
