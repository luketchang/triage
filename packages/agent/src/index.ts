import "dotenv/config";
import fs from "fs/promises";

import {
  GeminiModel,
  getDirectoryTree,
  getModelWrapper,
  logger,
  OpenAIModel,
} from "@triage/common";
import {
  DatadogCfgSchema,
  getObservabilityClient,
  GrafanaCfgSchema,
  IntegrationType,
} from "@triage/data-integrations";
import { Command as CommanderCommand } from "commander";
import { z } from "zod";

import { AgentConfig } from "./config";
import { TriagePipeline, TriagePipelineConfig } from "./pipeline";
import { StepsType, StreamUpdateFn } from "./pipeline/state";
import { PipelineStateManager } from "./pipeline/state-manager";
import { AssistantMessage, ChatMessage, UserMessage } from "./types/message";

/**
 * Arguments for invoking the agent
 */
export interface AgentArgs {
  userMessage: UserMessage;
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
  userMessage,
  chatHistory,
  agentCfg,
  startDate = new Date("2025-04-01T21:00:00Z"),
  endDate = new Date("2025-04-01T22:00:00Z"),
  onUpdate,
}: AgentArgs): Promise<AssistantMessage> {
  if (!agentCfg.codebaseOverview) {
    throw new Error("Codebase overview is required");
  }
  if (!agentCfg.repoPath) {
    throw new Error("Repo path is required");
  }
  const fileTree = await getDirectoryTree(agentCfg.repoPath);

  const observabilityClient = getObservabilityClient(agentCfg);
  // Get formatted labels map for time range
  const logLabelsMap = await observabilityClient.getLogsFacetValues(
    startDate.toISOString(),
    endDate.toISOString()
  );

  const pipelineConfig: TriagePipelineConfig = {
    userMessage,
    timezone: agentCfg.timezone,
    repoPath: agentCfg.repoPath,
    codebaseOverview: agentCfg.codebaseOverview.content,
    fileTree,
    logLabelsMap,
    reasoningClient: getModelWrapper(agentCfg.reasoningModel, agentCfg),
    fastClient: getModelWrapper(agentCfg.fastModel, agentCfg),
    observabilityClient,
  };

  const state = new PipelineStateManager(onUpdate, chatHistory);

  console.info("Chat history invokeAgent: ", JSON.stringify(chatHistory));

  logger.info(`Observability features: ${agentCfg.observabilityFeatures}`);

  try {
    const pipeline = new TriagePipeline(pipelineConfig, state);
    const response = await pipeline.run();

    return {
      role: "assistant",
      steps: state.getSteps(StepsType.CURRENT),
      response: response.answer,
      error: null,
    };
  } catch (error) {
    return {
      role: "assistant",
      steps: state.getSteps(StepsType.CURRENT),
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
  const codebaseOverview = await fs.readFile(overviewPath, "utf-8");
  const bugPath =
    "/Users/luketchang/code/triage/repos/ticketing/bugs/order-cancelled-publish-bug.txt";
  const timezone = "America/Los_Angeles";

  const bug = await fs.readFile(bugPath, "utf-8");

  // Create a UserMessage object for the agent
  const userMessage: UserMessage = {
    role: "user",
    content: bug,
    contextItems: [], // No context items for CLI usage
  };

  // Create an empty chat history
  const chatHistory: ChatMessage[] = [];

  // Configure the agent
  const agentCfg: AgentConfig = {
    repoPath,
    timezone,
    codebaseOverview: {
      content: codebaseOverview,
      repoPath,
    },
    observabilityClient: integration,
    reasoningModel: OpenAIModel.GPT_4_1,
    balancedModel: OpenAIModel.GPT_4_1,
    fastModel: GeminiModel.GEMINI_2_5_FLASH,
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
    sentry: {
      authToken: process.env.SENTRY_AUTH_TOKEN!,
    },
  };

  // Define the update handler
  const onUpdate: StreamUpdateFn = (update) => {
    if (update.type === "reasoning-chunk") {
      process.stdout.write(`${update.chunk}\n`);
    } else if (update.type === "logSearch-chunk") {
      process.stdout.write(`${update.chunk}\n`);
    } else if (update.type === "codeSearch-chunk") {
      process.stdout.write(`${update.chunk}\n`);
    }
  };

  // Invoke the agent with the UserMessage
  const response = await invokeAgent({
    userMessage,
    chatHistory,
    agentCfg,
    startDate,
    endDate,
    onUpdate,
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
export * from "./pipeline/state";
export * from "./types";
export * from "./utils";
