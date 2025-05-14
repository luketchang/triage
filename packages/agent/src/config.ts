import { LLMCfgSchema } from "@triage/common";
import { ConfigStore, DelegatingConfigStore } from "@triage/config";
import { ObservabilityCfgSchema } from "@triage/observability";
import { z } from "zod";

export const AgentCfgSchema = z.object({
  repoPath: z.string().optional(),
  codebaseOverview: z
    .object({
      content: z.string(),
      createdAt: z.string().optional(), // TODO: change to Date once we add support in electron-store
      commitHash: z.string().optional(),
    })
    .optional(),

  ...LLMCfgSchema.shape,
  ...ObservabilityCfgSchema.shape,
});
export type AgentConfig = z.infer<typeof AgentCfgSchema>;

export class AgentConfigStore extends DelegatingConfigStore<AgentConfig> {
  constructor(parentStore: ConfigStore<AgentConfig>) {
    super(parentStore, AgentCfgSchema);
  }
}
