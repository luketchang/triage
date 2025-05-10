#!/usr/bin/env node

import fs from "fs";
import path from "path";

import { getModelWrapper, Model, VALID_MODELS } from "@triage/common";
import { Command } from "commander";
import dotenv from "dotenv";

import { CodebaseProcessor } from "./processor";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "output");
/**
 * Main CLI function for generating codebase overviews
 */
export async function main(): Promise<void> {
  const program = new Command();

  program
    .name("generate-overview")
    .description("Generate an overview of a codebase using AI")
    .option("-p, --repo-path <path>", "Path to the local directory to analyze", process.cwd())
    .option(
      "-o, --output <path>",
      "Path to save the generated overview markdown file",
      DEFAULT_OUTPUT_DIR
    )
    .option(
      "-m, --model <model>",
      "AI model to use for generating the overview (e.g. gpt-4.1-mini-2025-04-14)",
      "gpt-4.1-mini-2025-04-14"
    )
    .option(
      "-s, --system-description <description>",
      "A brief description of the system (optional)",
      ""
    );

  program.parse(process.argv);

  const options = program.opts();
  const repoPath = path.resolve(options.repoPath);
  const outputDir = path.resolve(options.output);
  const modelName = options.model;
  // Validate that the model name is a valid Model from the enum
  if (!VALID_MODELS.includes(modelName)) {
    console.error(`Error: Invalid model name '${modelName}'`);
    throw new Error(`Invalid model name '${modelName}'`);
  }
  const model = modelName as Model;
  const systemDescription = options.systemDescription;

  // Verify the directory exists
  if (!fs.existsSync(repoPath)) {
    console.error(`Error: Directory ${repoPath} does not exist`);
    throw new Error(`Directory ${repoPath} does not exist`);
  }

  try {
    console.info(`Analyzing codebase at: ${repoPath}`);
    console.info(`Using model: ${model}`);
    console.info(`Overview will be saved to: ${path.join(outputDir, "codebase-overview.md")}`);

    const llmClient = getModelWrapper(model, {
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      googleApiKey: process.env.GOOGLE_API_KEY,
    });
    const processor = new CodebaseProcessor(llmClient, repoPath, systemDescription, outputDir);
    await processor.process();

    console.info("Overview generation complete!");
    console.info(`Overview has been saved to ${path.join(outputDir, "codebase-overview.md")}`);
  } catch (error) {
    console.error("Error generating overview:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error("Error in main:", error);
  throw error;
});
