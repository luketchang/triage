import { anthropic as anthropicAI } from "@ai-sdk/anthropic";
import { google as googleAI } from "@ai-sdk/google";
import { openai as openaiAI } from "@ai-sdk/openai";
import { LanguageModelV1 } from "@ai-sdk/provider";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { appConfig } from "@triage/config";
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: appConfig.openaiApiKey,
  timeout: 1000 * 60, // 60 seconds
});

export const anthropic = new Anthropic({
  apiKey: appConfig.anthropicApiKey,
  timeout: 1000 * 60, // 60 seconds
});

export const gemini = appConfig.googleApiKey
  ? new GoogleGenerativeAI(appConfig.googleApiKey)
  : null;

export enum AnthropicModel {
  CLAUDE_3_7_SONNET_20250219 = "claude-3-7-sonnet-20250219",
  CLAUDE_3_5_SONNET_20240620 = "claude-3-5-sonnet-20240620",
  CLAUDE_3_5_SONNET_20241022 = "claude-3-5-sonnet-20241022",
  CLAUDE_3_5_HAIKU_20241022 = "claude-3-5-haiku-20241022",
}

export enum OpenAIModel {
  O4_MINI = "o4-mini-2025-04-16",
  O3_MINI = "o3-mini-2025-01-31",
  GPT_4_O = "gpt-4o-2024-08-06",
  GPT_4_1_MINI = "gpt-4.1-mini-2025-04-14",
}

export enum GeminiModel {
  GEMINI_2_5_PRO = "gemini-2.5-pro-preview-03-25",
  GEMINI_2_5_FLASH = "gemini-2.5-flash-preview-04-17",
}

export type Model = AnthropicModel | OpenAIModel | GeminiModel;

export const VALID_MODELS = [
  ...Object.values(AnthropicModel),
  ...Object.values(OpenAIModel),
  ...Object.values(GeminiModel),
];

/**
 * Get the appropriate AI SDK model wrapper based on the model type
 * @param model The model to use
 * @returns The appropriate AI SDK model wrapper
 */
export function getModelWrapper(model: Model): LanguageModelV1 {
  if (Object.values(AnthropicModel).includes(model as AnthropicModel)) {
    return anthropicAI(model);
  } else if (Object.values(OpenAIModel).includes(model as OpenAIModel)) {
    return openaiAI(model);
  } else if (Object.values(GeminiModel).includes(model as GeminiModel)) {
    return googleAI(model);
  } else {
    throw new Error(`Unsupported model: ${model}`);
  }
}

/**
 * Check if a model is an Anthropic model
 * @param model The model to check
 * @returns True if the model is an Anthropic model
 */
export function isAnthropicModel(model: Model): model is AnthropicModel {
  return Object.values(AnthropicModel).includes(model as AnthropicModel);
}

/**
 * Check if a model is an OpenAI model
 * @param model The model to check
 * @returns True if the model is an OpenAI model
 */
export function isOpenAIModel(model: Model): model is OpenAIModel {
  return Object.values(OpenAIModel).includes(model as OpenAIModel);
}

/**
 * Check if a model is a Google Gemini model
 * @param model The model to check
 * @returns True if the model is a Gemini model
 */
export function isGeminiModel(model: Model): model is GeminiModel {
  return Object.values(GeminiModel).includes(model as GeminiModel);
}
