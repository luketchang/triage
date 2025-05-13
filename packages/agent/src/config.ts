import { GeminiModel, LLMCfgSchema, Model } from "@triage/common";
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

  reasoningModel: z.custom<Model>().default(GeminiModel.GEMINI_2_5_PRO),
  fastModel: z.custom<Model>().default(GeminiModel.GEMINI_2_5_FLASH),

  ...LLMCfgSchema.shape,
  ...ObservabilityCfgSchema.shape,
});
export type AgentConfig = z.infer<typeof AgentCfgSchema>;

export class AgentConfigStore extends DelegatingConfigStore<AgentConfig> {
  constructor(parentStore: ConfigStore<AgentConfig>) {
    super(parentStore, AgentCfgSchema);
  }
}
