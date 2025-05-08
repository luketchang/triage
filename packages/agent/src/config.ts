import { LLMCfgSchema } from "@triage/common/src/config";
import { GeminiModel, Model } from "@triage/common/src/llm";
import { ConfigStore, DelegatingConfigStore } from "@triage/config";
import { ObservabilityCfgSchema } from "@triage/observability";
import { z } from "zod";

export const AgentCfgSchema = z.object({
  repoPath: z.string().optional(),
  codebaseOverviewPath: z.string().optional(),

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
