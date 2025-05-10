import fs from "fs/promises";
import path from "path";

import { GeminiModel, getModelWrapper, loadFileTree, logger } from "@triage/common";
import { DatadogCfgSchema, getObservabilityPlatform } from "@triage/observability";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

import { CodeSearchAgent } from "./nodes/code-search";
import { LogSearchAgent } from "./nodes/log-search";
import { TriagePipelineConfig } from "./pipeline";
import { Toolbox } from "./tools";
import { CodeSearchStep } from "./types";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

// Hardcoded values from .env
const repoPath = "/Users/luketchang/code/ticketing";
const codebaseOverviewPath = "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md";
const observabilityPlatformName = "datadog" as const;
const observabilityFeatures = ["logs"] as Array<"logs" | "spans">;
const startDate = new Date("2025-05-02T02:00:00Z");
const endDate = new Date("2025-05-02T03:00:00Z");
const reasoningModel = GeminiModel.GEMINI_2_5_FLASH;
const fastModel = GeminiModel.GEMINI_2_5_FLASH;
const googleApiKey = process.env.GOOGLE_API_KEY || "";

/**
 * Main function to run the code search agent
 */
async function main(): Promise<void> {
  try {
    // Read codebase overview and file tree
    const codebaseOverview = await fs.readFile(codebaseOverviewPath, "utf-8");
    const fileTree = loadFileTree(repoPath);
    const query = await fs.readFile(
      "/Users/luketchang/code/triage/repos/ticketing/bugs/rabbitmq-bug.txt",
      "utf-8"
    );

    // Observability config for platform
    const agentCfg = {
      repoPath,
      codebaseOverviewPath,
      reasoningModel,
      fastModel,
      observabilityPlatform: observabilityPlatformName,
      observabilityFeatures,
      datadog: DatadogCfgSchema.parse({
        apiKey: process.env.DATADOG_API_KEY!,
        appKey: process.env.DATADOG_APP_KEY!,
      }),
    };

    const observabilityPlatform = getObservabilityPlatform(agentCfg);

    // Get log labels map
    const logLabelsMap = await observabilityPlatform.getLogsFacetValues(
      startDate.toISOString(),
      endDate.toISOString()
    );

    // Wrap models
    const reasoningClient = getModelWrapper(reasoningModel, { googleApiKey });
    const fastClient = getModelWrapper(fastModel, { googleApiKey });

    // Construct config
    const config: TriagePipelineConfig = {
      query,
      repoPath,
      codebaseOverview,
      fileTree,
      logLabelsMap,
      reasoningClient,
      fastClient,
      observabilityPlatform,
    };

    // Create toolbox with null LogSearchAgent (we're only using CodeSearchAgent)
    const toolbox = new Toolbox(observabilityPlatform, null as unknown as LogSearchAgent);

    // Run the agent
    const agent = new CodeSearchAgent(config, toolbox);
    const params = {
      codeSearchId: uuidv4(),
      query: config.query,
      codeRequest:
        "fetch code relevant to the issue/event that will give you a full picture of the issue/event",
      fileTree: config.fileTree,
      previousCodeSearchSteps: [] as CodeSearchStep[],
      codebaseOverview: config.codebaseOverview,
    };

    logger.info("Running code search with query: " + params.query);
    const result = await agent.invoke(params);
    logger.info(result.newCodeSearchSteps.map((step) => step.filepath).join("\n"));
    // logger.info("CodeSearchAgent result: " + JSON.stringify(result, null, 2));
  } catch (error) {
    logger.error("Error running code search: " + error);
    throw error;
  }
}

main().catch((err: unknown) => {
  logger.error("Unhandled error: " + err);
  throw err;
});
