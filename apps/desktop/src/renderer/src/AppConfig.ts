import { AgentCfgSchema } from "@triage/agent";
import { ConfigStore, DelegatingConfigStore } from "@triage/config";
import { z } from "zod";

// Note: All values should be optional or have defaults.
export const AppCfgSchema = z.object({
  ...AgentCfgSchema.shape,
  githubRepoBaseUrl: z.string().url(),
});

export type AppConfig = z.infer<typeof AppCfgSchema>;

/**
 * Combined config view that manages all application configuration
 */
export class AppConfigStore extends DelegatingConfigStore<AppConfig> {
  constructor(parentStore: ConfigStore<AppConfig>) {
    super(parentStore, AppCfgSchema);
  }
}
