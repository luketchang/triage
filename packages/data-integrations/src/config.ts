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

export const GcloudCfgSchema = z.object({
  authToken: configSecret(z.string()),
  projectId: z.string(),
});
export type GcloudConfig = z.infer<typeof GcloudCfgSchema>;

export const SentryCfgSchema = z.object({
  authToken: configSecret(z.string()),
});

export const DataIntegrationsCfgSchema = z.object({
  logsProvider: z.enum(["datadog", "grafana", "gcloud"]).optional().default("datadog"),
  tracesProvider: z.enum(["datadog", "grafana"]).optional().default("datadog"),
  datadog: DatadogCfgSchema.optional(),
  grafana: GrafanaCfgSchema.optional(),
  gcloud: GcloudCfgSchema.optional(),
  sentry: SentryCfgSchema.optional(),
});
export type DataIntegrationsConfig = z.infer<typeof DataIntegrationsCfgSchema>;

export class DataIntegrationsConfigStore extends DelegatingConfigStore<DataIntegrationsConfig> {
  constructor(parentStore: ConfigStore<DataIntegrationsConfig>) {
    super(parentStore, DataIntegrationsCfgSchema);
  }
}
