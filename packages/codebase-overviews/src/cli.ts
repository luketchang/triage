#!/usr/bin/env node

import { Model, VALID_MODELS } from "@triage/common";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { CodebaseProcessor } from "./processor";

const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "output");
/**
 * Main CLI function for generating codebase overviews
 */
export async function main() {
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
    process.exit(1);
  }
  const model = modelName as Model;
  const systemDescription = options.systemDescription;

  // Verify the directory exists
  if (!fs.existsSync(repoPath)) {
    console.error(`Error: Directory ${repoPath} does not exist`);
    process.exit(1);
  }

  try {
    console.log(`Analyzing codebase at: ${repoPath}`);
    console.log(`Using model: ${model}`);
    console.log(`Overview will be saved to: ${path.join(outputDir, "codebase-overview.md")}`);

    const processor = new CodebaseProcessor(model, repoPath, systemDescription, outputDir);
    await processor.process();

    console.log("Overview generation complete!");
    console.log(`Overview has been saved to ${path.join(outputDir, "codebase-overview.md")}`);
  } catch (error) {
    console.error("Error generating overview:", error);
    process.exit(1);
  }
}

main();
