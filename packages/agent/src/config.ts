import { LLMCfgSchema } from "@triage/common";
import { ConfigStore, DelegatingConfigStore } from "@triage/config";
import { ObservabilityCfgSchema, SentryCfgSchema } from "@triage/data-integrations";
import { z } from "zod";

export const AgentCfgSchema = z.object({
  repoPath: z.string().optional(),
  codebaseOverview: z
    .object({
      content: z.string().describe("The content of the codebase overview"),
      repoPath: z
        .string()
        .describe("Path to the repo for which the codebase overview was generated")
        .optional(),
      // TODO: change to Date once we add support in electron-store
      createdAt: z.string().describe("When the codebase overview was generated").optional(),
      commitHash: z
        .string()
        .describe("Commit hash of the repo when the codebase overview was generated")
        .optional(),
    })
    .optional(),
  timezone: z.string().describe("Timezone to use for date formatting").default("UTC"),

  ...LLMCfgSchema.shape,
  ...ObservabilityCfgSchema.shape,
  ...SentryCfgSchema.shape,
});
export type AgentConfig = z.infer<typeof AgentCfgSchema>;

export class AgentConfigStore extends DelegatingConfigStore<AgentConfig> {
  constructor(parentStore: ConfigStore<AgentConfig>) {
    super(parentStore, AgentCfgSchema);
  }
}
