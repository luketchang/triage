import { configSecret } from "@triage/config";
import { z } from "zod";

import { GeminiModel, Model, OpenAIModel } from "./llm";

export const LLMApiKeyCfgSchema = z.object({
  openaiApiKey: configSecret(z.string()).optional(),
  anthropicApiKey: configSecret(z.string()).optional(),
  googleApiKey: configSecret(z.string()).optional(),
});
export type LLMApiKeyConfig = z.infer<typeof LLMApiKeyCfgSchema>;

export const LLMCfgSchema = z.object({
  reasoningModel: z.custom<Model>().default(GeminiModel.GEMINI_2_5_PRO),
  balancedModel: z.custom<Model>().default(OpenAIModel.GPT_4_1),
  fastModel: z.custom<Model>().default(GeminiModel.GEMINI_2_5_FLASH),
  ...LLMApiKeyCfgSchema.shape,
});
export type LLMConfig = z.infer<typeof LLMCfgSchema>;
