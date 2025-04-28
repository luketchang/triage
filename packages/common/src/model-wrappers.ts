import { anthropic as anthropicAI } from "@ai-sdk/anthropic";
import { google as googleAI } from "@ai-sdk/google";
import { openai as openaiAI } from "@ai-sdk/openai";
import { LanguageModelV1 } from "@ai-sdk/provider";

import { AnthropicModel, GeminiModel, Model, OpenAIModel } from "./llm";

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
