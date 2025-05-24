import { configSecret, ConfigStore, DelegatingConfigStore } from "@triage/config";
import { z } from "zod";

export const SentryInternalCfgSchema = z.object({
  authToken: configSecret(z.string()),
});

export const SentryCfgSchema = z.object({
  sentry: SentryInternalCfgSchema.optional(),
});
export type SentryConfig = z.infer<typeof SentryCfgSchema>;

export class SentryConfigStore extends DelegatingConfigStore<SentryConfig> {
  constructor(parentStore: ConfigStore<SentryConfig>) {
    super(parentStore, SentryCfgSchema);
  }
}
