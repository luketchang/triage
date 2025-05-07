import { configSecret } from "@triage/config";
import { z } from "zod";

export const LLMCfgSchema = z.object({
  openaiApiKey: configSecret(z.string()).optional(),
  anthropicApiKey: configSecret(z.string()).optional(),
  googleApiKey: configSecret(z.string()).optional(),
});

export type LLMConfig = z.infer<typeof LLMCfgSchema>;
