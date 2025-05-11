import "dotenv/config";
import fs from "fs/promises";

import { GeminiModel, getModelWrapper, loadFileTree, logger } from "@triage/common";
import {
  DatadogCfgSchema,
  getObservabilityPlatform,
  GrafanaCfgSchema,
  IntegrationType,
} from "@triage/observability";
import { Command as CommanderCommand } from "commander";
import { z } from "zod";

import { AgentConfig } from "./config";
import { TriagePipeline, TriagePipelineConfig } from "./pipeline";
import { PipelineStateManager, StreamUpdateFn } from "./pipeline/state";
import type { ChatMessage } from "./types";
import { AssistantMessage } from "./types";

/**
 * Arguments for invoking the agent
 */
export interface AgentArgs {
  query: string;
  chatHistory: ChatMessage[];
  agentCfg: AgentConfig;
  startDate?: Date;
  endDate?: Date;
  onUpdate: StreamUpdateFn;
}

/**
 * Invokes the agent with the given parameters
 */
export async function invokeAgent({
  query,
  chatHistory,
  agentCfg,
  startDate = new Date("2025-04-01T21:00:00Z"),
  endDate = new Date("2025-04-01T22:00:00Z"),
  onUpdate,
}: AgentArgs): Promise<AssistantMessage> {
  if (!agentCfg.codebaseOverviewPath) {
    throw new Error("Codebase overview path is required");
  }
  if (!agentCfg.repoPath) {
    throw new Error("Repo path is required");
  }
  const codebaseOverview = await fs.readFile(agentCfg.codebaseOverviewPath, "utf-8");
  const fileTree = loadFileTree(agentCfg.repoPath);

  const observabilityPlatform = getObservabilityPlatform(agentCfg);
  // Get formatted labels map for time range
  const logLabelsMap = await observabilityPlatform.getLogsFacetValues(
    startDate.toISOString(),
    endDate.toISOString()
  );

  logger.info(`Chat history still not being used: ${JSON.stringify(chatHistory)}`);

  const pipelineConfig: TriagePipelineConfig = {
    query,
    repoPath: agentCfg.repoPath,
    codebaseOverview,
    fileTree,
    logLabelsMap,
    reasoningClient: getModelWrapper(agentCfg.reasoningModel, agentCfg),
    fastClient: getModelWrapper(agentCfg.fastModel, agentCfg),
    observabilityPlatform,
  };

  const state = new PipelineStateManager(onUpdate);
  // Note: We still aren't persisting LLM messages between invocations.
  // Probably what we want in the future is to delegate the output of the reasoner
  // to a new agent optimized for follow-up questions.
  state.initChatHistory(chatHistory);

  logger.info(`Observability features: ${agentCfg.observabilityFeatures}`);

  try {
    const pipeline = new TriagePipeline(pipelineConfig, state);
    const response = await pipeline.run();

    return {
      role: "assistant",
      steps: state.getSteps(),
      response: response.answer,
      error: null,
    };
  } catch (error) {
    return {
      role: "assistant",
      steps: state.getSteps(),
      response: null,
      error: `${error}`,
    };
  }
}

const parseArgs = (): { integration: "datadog" | "grafana"; features: string[] } => {
  const argsSchema = z.object({
    orgId: z.string().optional(),
    integration: z
      .enum(["datadog", "grafana"])
      .default("datadog")
      .transform((value) => value as IntegrationType),
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

  const repoPath = "/Users/luketchang/code/ticketing";
  const overviewPath = "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md";
  const bugPath =
    "/Users/luketchang/code/triage/repos/ticketing/bugs/order-cancelled-publish-bug.txt";

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
    agentCfg: {
      repoPath,
      codebaseOverviewPath: overviewPath,
      reasoningModel: GeminiModel.GEMINI_2_5_PRO,
      fastModel: GeminiModel.GEMINI_2_5_FLASH,
      observabilityPlatform: integration,
      observabilityFeatures: observabilityFeatures as ("logs" | "spans")[],
      datadog:
        integration === "datadog"
          ? DatadogCfgSchema.parse({
              apiKey: process.env.DATADOG_API_KEY!,
              appKey: process.env.DATADOG_APP_KEY!,
            })
          : undefined,
      grafana:
        integration === "grafana"
          ? GrafanaCfgSchema.parse({
              baseUrl: process.env.GRAFANA_BASE_URL!,
              username: process.env.GRAFANA_USERNAME!,
              password: process.env.GRAFANA_PASSWORD!,
            })
          : undefined,
    },
    startDate,
    endDate,
    onUpdate: (update) => {
      if (update.type === "highLevelUpdate") {
        process.stdout.write(`\nHighLevelUpdate: ${update.stage}\n`);
      } else if (update.type === "intermediateUpdate") {
        switch (update.step.type) {
          case "reasoning":
            process.stdout.write(`${update.step.contentChunk}\n`);
            break;
          case "review":
            process.stdout.write(`${update.step.contentChunk}\n`);
            break;
          default:
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
export * from "./config";
export * from "./nodes/log-search";
export * from "./nodes/reasoner";
export * from "./nodes/reviewer";
export * from "./nodes/utils";
export * from "./pipeline/state";
export * from "./types";
