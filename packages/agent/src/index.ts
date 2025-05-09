import fs from "fs/promises";

import { GeminiModel, loadFileTree, logger } from "@triage/common";
import { getObservabilityPlatform, IntegrationType } from "@triage/observability";
import { Command as CommanderCommand } from "commander";
import { z } from "zod";

import { TriagePipeline, TriagePipelineConfig } from "./pipeline";
import type { ChatMessage } from "./types";
import { AgentStreamUpdate, AssistantMessage } from "./types";

/**
 * Arguments for invoking the agent
 */
export interface AgentArgs {
  query: string;
  chatHistory: ChatMessage[];
  repoPath: string;
  codebaseOverviewPath: string;
  observabilityPlatform?: string;
  observabilityFeatures?: string[];
  startDate?: Date;
  endDate?: Date;
  reasonOnly?: boolean;
  onUpdate?: (update: AgentStreamUpdate) => void;
}

/**
 * Invokes the agent with the given parameters
 */
export async function invokeAgent({
  query,
  chatHistory,
  repoPath,
  codebaseOverviewPath,
  observabilityPlatform: platformType = "grafana",
  observabilityFeatures = ["logs"],
  startDate = new Date("2025-04-01T21:00:00Z"),
  endDate = new Date("2025-04-01T22:00:00Z"),
  reasonOnly = false,
  onUpdate,
}: AgentArgs): Promise<AssistantMessage> {
  // If reasonOnly is true, override observabilityFeatures to be empty
  if (reasonOnly) {
    observabilityFeatures = [];
  }

  logger.info(`Chat history still not being used: ${JSON.stringify(chatHistory)}`);

  const integrationType =
    platformType === "datadog" ? IntegrationType.DATADOG : IntegrationType.GRAFANA;

  const observabilityPlatform = getObservabilityPlatform(integrationType);

  // Get formatted labels map for time range
  const logLabelsMap = await observabilityPlatform.getLogsFacetValues(
    startDate.toISOString(),
    endDate.toISOString()
  );

  // Load the codebase overview
  const overview = await fs.readFile(codebaseOverviewPath, "utf-8");

  const pipelineConfig: TriagePipelineConfig = {
    query,
    repoPath,
    codebaseOverview: overview,
    fileTree: loadFileTree(repoPath),
    logLabelsMap,
    reasoningModel: GeminiModel.GEMINI_2_5_PRO,
    fastModel: GeminiModel.GEMINI_2_5_FLASH,
    observabilityPlatform,
    onUpdate,
  };

  logger.info(`Observability features: ${observabilityFeatures}`);

  const pipeline = new TriagePipeline(pipelineConfig);
  const response = await pipeline.run();

  return {
    role: "assistant",
    steps: [], // TODO: Front-end currently ignores this
    response: response.answer,
    error: null,
  };
}

const parseArgs = (): { integration: "datadog" | "grafana"; features: string[] } => {
  const argsSchema = z.object({
    orgId: z.string().optional(),
    integration: z.enum(["datadog", "grafana"]).default("datadog"),
    features: z
      .string()
      .default("logs")
      .transform((str) => str.split(",").map((f) => f.trim()))
      .refine((f) => f.every((feat) => ["logs", "spans"].includes(feat)), {
        message: "Features must be: logs, spans",
      }),
  });

  const program = new CommanderCommand()
    .option("-i, --integration <integration>", "Integration type (datadog or grafana)")
    .option("-f, --features <features>", "Features to enable (logs,spans)")
    .parse();

  return argsSchema.parse(program.opts());
};

async function main(): Promise<void> {
  const { integration, features: observabilityFeatures } = parseArgs();

  // Get formatted labels map for time range
  const startDate = new Date("2025-05-02T02:00:00Z");
  const endDate = new Date("2025-05-02T03:00:00Z");

  const repoPath = "/Users/rob/code/ticketing";

  // Load or generate the codebase overview
  const overviewPath = "/Users/rob/code/triage/repos/ticketing/codebase-analysis.md";
  const bugPath = "/Users/rob/code/triage/repos/ticketing/bugs/rabbitmq-bug.txt";

  const bug = await fs.readFile(bugPath, "utf-8");

  const chatHistory: ChatMessage[] = [
    {
      role: "user",
      content: bug,
    },
  ];

  // Use invokeAgent instead of duplicating the logic
  const response = await invokeAgent({
    query: bug,
    chatHistory,
    repoPath,
    codebaseOverviewPath: overviewPath,
    observabilityPlatform: integration,
    observabilityFeatures,
    startDate,
    endDate,
    onUpdate: (update) => {
      if (update.type === "highLevelUpdate") {
        process.stdout.write(`\nHighLevelUpdate: ${update.stepType}\n`);
      } else if (update.type === "intermediateUpdate") {
        switch (update.step.type) {
          case "reasoning":
            process.stdout.write(`${update.step.contentChunk}\n`);
            break;
          case "review":
            process.stdout.write(`${update.step.contentChunk}\n`);
            break;
          default:
            process.stdout.write(`${JSON.stringify(update.step, null, 2)}\n`);
            break;
        }
      }
    },
  });

  logger.info(`Steps: ${JSON.stringify(response.steps)}`);
  logger.info(`Response: ${response.response}`);
  logger.info(`Error: ${response.error}`);
}

/**
 * Run the CLI application
 * @returns A promise that resolves when the CLI completes
 */
export async function runCLI(): Promise<void> {
  return (
    main()
      // eslint-disable-next-line no-process-exit
      .then(() => process.exit(0))
      .catch((error) => {
        console.error("Error in main:", error);
        // eslint-disable-next-line no-process-exit
        process.exit(1);
      })
  );
}

// Only run the main function if this file is being executed directly
// This is the Node.js equivalent of Python's if __name__ == "__main__":
// Using typeof check to avoid issues in different module systems
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  void runCLI();
}

// Agent package exports
export * from "./nodes/log-search";
export * from "./nodes/reasoner";
export * from "./nodes/reviewer";
export * from "./nodes/utils";
export * from "./types";
