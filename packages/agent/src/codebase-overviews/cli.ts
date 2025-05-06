import { logger, OpenAIModel } from "@triage/common";
import { Command } from "commander";
import * as dotenv from "dotenv";
import { CodebaseProcessor } from "./processor/codebase-processor";

console.info("Current working directory:", process.cwd());
console.info("Environment variables:", {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "Set" : "Not set",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "Set" : "Not set",
});

dotenv.config();

/**
 * Runs the CLI for generating codebase overviews
 */
export async function runCLI(): Promise<void> {
  const program = new Command();

  program
    .name("codebase-overview")
    .description("Generate a codebase overview from a GitHub repository")
    .requiredOption("--repo-url <url>", "GitHub repository URL to clone and analyze")
    .option("--model <model>", "LLM model to use", OpenAIModel.GPT_4_O)
    .option("--system-description <description>", "Optional system description for context", "");

  program.parse();
  const options = program.opts();

  try {
    const model = options.model;
    logger.info(`Using model: ${model}`);

    const processor = new CodebaseProcessor(model, options.repoUrl, options.systemDescription);

    const finalDocument = await processor.process();
    logger.info(`Final Document:\n${finalDocument}`);
  } catch (error) {
    logger.error(`Error: ${error}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(1);
  }
}
