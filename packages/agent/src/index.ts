import { AnthropicModel, loadFileTree, logger, Model, OpenAIModel } from "@triage/common";
import {
  getObservabilityPlatform,
  IntegrationType,
  ObservabilityPlatform,
} from "@triage/observability";
import { Command as CommanderCommand } from "commander";
import fs from "fs/promises";
import { z } from "zod";
import { Planner } from "./nodes/planner";
import { Reasoner } from "./nodes/reasoner";
import { Reviewer } from "./nodes/reviewer";
import { CodeSearch } from "./nodes/search/code-search";
import { LogSearchAgent } from "./nodes/search/log-search";
import { SpanSearchAgent } from "./nodes/search/span-search";

// Type definitions
type NodeType =
  | "planner"
  | "spanSearch"
  | "logSearch"
  | "codeSearch"
  | "reasoner"
  | "reviewer"
  | "END";

interface BaseCommand {
  update: Partial<OncallAgentState>;
}

interface NextNodeCommand extends BaseCommand {
  type: "next";
  destination: NodeType;
}

interface EndCommand extends BaseCommand {
  type: "end";
}

type Command = NextNodeCommand | EndCommand;

export interface OncallAgentState {
  firstPass: boolean;
  codeRequest: string | null;
  spanRequest: string | null;
  logRequest: string | null;
  query: string;
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  labelsMap: string;
  chatHistory: string[];
  codeContext: Record<string, string>;
  logContext: Record<string, string>;
  spanContext: Record<string, string>;
  rootCauseAnalysis: string | null;
}

export class OnCallAgent {
  private reasoningModel: Model;
  private fastModel: Model;
  private observabilityPlatform: ObservabilityPlatform;
  private observabilityFeatures: string[];

  constructor(
    reasoningModel: Model,
    fastModel: Model,
    observabilityPlatform: ObservabilityPlatform,
    observabilityFeatures: string[]
  ) {
    this.reasoningModel = reasoningModel;
    this.fastModel = fastModel;
    this.observabilityPlatform = observabilityPlatform;
    this.observabilityFeatures = observabilityFeatures;
  }

  async plan(state: OncallAgentState): Promise<Command> {
    logger.info("\n\n" + "=".repeat(25) + " Planner " + "=".repeat(25));
    const planner = new Planner(this.reasoningModel);
    const response = await planner.invoke({
      query: state.query,
      repoPath: state.repoPath,
      codebaseOverview: state.codebaseOverview,
      fileTree: state.fileTree,
      labelsMap: state.labelsMap,
    });

    return {
      type: "next",
      destination: "logSearch",
      update: {
        codeRequest: response.codeRequest,
        spanRequest: response.spanRequest,
        logRequest: response.logRequest,
      },
    };
  }

  async logSearch(state: OncallAgentState): Promise<Command> {
    logger.info("\n\n" + "=".repeat(25) + " Log Search " + "=".repeat(25));

    if (!this.observabilityFeatures.includes("logs")) {
      logger.info("Log search not enabled, skipping");
      if (state.firstPass) {
        return {
          type: "next",
          destination: "spanSearch",
          update: {},
        };
      }

      return {
        type: "next",
        destination: "reasoner",
        update: {},
      };
    }

    const logSearchAgent = new LogSearchAgent(
      this.fastModel,
      this.reasoningModel,
      this.observabilityPlatform
    );
    const response = await logSearchAgent.invoke({
      query: state.query,
      logRequest: state.logRequest ?? "",
      labelsMap: state.labelsMap,
      chatHistory: state.chatHistory,
    });

    if (state.firstPass) {
      return {
        type: "next",
        destination: "spanSearch",
        update: {
          logContext: { ...state.logContext, ...response.newLogContext },
          chatHistory: [...state.chatHistory, response.summary],
        },
      };
    }

    return {
      type: "next",
      destination: "reasoner",
      update: {
        logContext: { ...state.logContext, ...response.newLogContext },
        chatHistory: [...state.chatHistory, response.summary],
      },
    };
  }

  async spanSearch(state: OncallAgentState): Promise<Command> {
    logger.info("\n\n" + "=".repeat(25) + " Span Search " + "=".repeat(25));

    if (!this.observabilityFeatures.includes("spans")) {
      logger.info("Span search not enabled, skipping");
      if (state.firstPass) {
        return {
          type: "next",
          destination: "codeSearch",
          update: {},
        };
      }

      return {
        type: "next",
        destination: "reasoner",
        update: {},
      };
    }

    const spanSearchAgent = new SpanSearchAgent(
      this.fastModel,
      this.reasoningModel,
      this.observabilityPlatform
    );
    const response = await spanSearchAgent.invoke({
      query: state.query,
      spanRequest: state.spanRequest ?? "",
      labelsMap: state.labelsMap,
      chatHistory: state.chatHistory,
    });

    if (state.firstPass) {
      return {
        type: "next",
        destination: "codeSearch",
        update: {
          spanContext: { ...state.spanContext, ...response.newSpanContext },
          chatHistory: [...state.chatHistory, response.summary],
        },
      };
    }

    return {
      type: "next",
      destination: "reasoner",
      update: {
        spanContext: { ...state.spanContext, ...response.newSpanContext },
        chatHistory: [...state.chatHistory, response.summary],
      },
    };
  }

  async codeSearch(state: OncallAgentState): Promise<Command> {
    logger.info("\n\n" + "=".repeat(25) + " Code Search " + "=".repeat(25));
    const codeSearch = new CodeSearch(state.repoPath);
    const response = await codeSearch.invoke({
      query: state.query,
      repoPath: state.repoPath,
      codebaseOverview: state.codebaseOverview,
      fileTree: state.fileTree,
      chatHistory: state.chatHistory,
      codeRequest: state.codeRequest ?? "",
      filesRead: state.codeContext,
    });

    return {
      type: "next",
      destination: "reasoner",
      update: {
        chatHistory: [...state.chatHistory, response.summary],
        codeContext: { ...state.codeContext, ...response.newFilesRead },
      },
    };
  }

  async reason(state: OncallAgentState): Promise<Command> {
    logger.info("\n\n" + "=".repeat(25) + " Reasoning " + "=".repeat(25));
    const reasoner = new Reasoner(this.reasoningModel);
    const response = await reasoner.invoke({
      query: state.query,
      repoPath: state.repoPath,
      codebaseOverview: state.codebaseOverview,
      fileTree: state.fileTree,
      chatHistory: state.chatHistory,
      codeContext: state.codeContext,
      logContext: state.logContext,
      spanContext: state.spanContext,
      labelsMap: state.labelsMap,
    });

    logger.info(`Reasoning response: ${JSON.stringify(response)}`);

    if (response.type === "rootCauseAnalysis") {
      return {
        type: "next",
        destination: "reviewer",
        update: {
          rootCauseAnalysis: response.rootCause,
          chatHistory: [...state.chatHistory, response.reasoning],
          // NOTE: we intentionally reset requests so future calls are not anchored by them
          codeRequest: null,
          spanRequest: null,
          logRequest: null,
          firstPass: false,
        },
      };
    } else if (response.type === "spanRequest") {
      return {
        type: "next",
        destination: "spanSearch",
        update: {
          chatHistory: [...state.chatHistory, response.reasoning],
          spanRequest: response.request,
          codeRequest: null,
          logRequest: null,
          firstPass: false,
        },
      };
    } else if (response.type === "logRequest") {
      return {
        type: "next",
        destination: "logSearch",
        update: {
          chatHistory: [...state.chatHistory, response.reasoning],
          logRequest: response.request,
          codeRequest: null,
          spanRequest: null,
          firstPass: false,
        },
      };
    } else {
      return {
        type: "next",
        destination: "codeSearch",
        update: {
          chatHistory: [...state.chatHistory, response.reasoning],
          codeRequest: response.request,
          spanRequest: null,
          logRequest: null,
          firstPass: false,
        },
      };
    }
  }

  async review(state: OncallAgentState): Promise<Command> {
    logger.info("\n\n" + "=".repeat(25) + " Review " + "=".repeat(25));
    const reviewer = new Reviewer(this.reasoningModel);
    const response = await reviewer.invoke({
      query: state.query,
      repoPath: state.repoPath,
      codebaseOverview: state.codebaseOverview,
      fileTree: state.fileTree,
      labelsMap: state.labelsMap,
      chatHistory: state.chatHistory,
      codeContext: state.codeContext,
      logContext: state.logContext,
      rootCauseAnalysis: state.rootCauseAnalysis ?? "",
    });

    logger.info(`Reviewer reasoning: ${response.reasoning}`);
    logger.info(`Reviewer output: ${JSON.stringify(response)}`);

    if (response.type === "codeRequest") {
      return {
        type: "next",
        destination: "codeSearch",
        update: {
          chatHistory: [...state.chatHistory, response.reasoning],
          codeRequest: response.request,
        },
      };
    } else if (response.type === "spanRequest") {
      return {
        type: "next",
        destination: "spanSearch",
        update: {
          chatHistory: [...state.chatHistory, response.reasoning],
          spanRequest: response.request,
          codeRequest: null,
          logRequest: null,
        },
      };
    } else if (response.type === "logRequest") {
      return {
        type: "next",
        destination: "logSearch",
        update: {
          chatHistory: [...state.chatHistory, response.reasoning],
          logRequest: response.request,
          codeRequest: null,
          spanRequest: null,
        },
      };
    } else {
      return {
        type: "end",
        update: {
          chatHistory: [...state.chatHistory, response.reasoning],
        },
      };
    }
  }

  buildGraph(): Map<NodeType, (state: OncallAgentState) => Promise<Command> | Command> {
    const nodeMap = new Map<NodeType, (state: OncallAgentState) => Promise<Command> | Command>();

    nodeMap.set("planner", this.plan.bind(this));
    nodeMap.set("spanSearch", this.spanSearch.bind(this));
    nodeMap.set("logSearch", this.logSearch.bind(this));
    nodeMap.set("codeSearch", this.codeSearch.bind(this));
    nodeMap.set("reasoner", this.reason.bind(this));
    nodeMap.set("reviewer", this.review.bind(this));

    return nodeMap;
  }

  async invoke(
    input: Partial<OncallAgentState>
  ): Promise<{ chatHistory: string[]; rca: string | null }> {
    // Initialize state with defaults and input
    // TODO: Should probably be part of a database / figure out that as well eventually
    const initialState: OncallAgentState = {
      firstPass: true,
      codeRequest: null,
      spanRequest: null,
      logRequest: null,
      query: "",
      repoPath: "",
      codebaseOverview: "",
      fileTree: "",
      labelsMap: "",
      chatHistory: [],
      codeContext: {},
      logContext: {},
      spanContext: {},
      rootCauseAnalysis: null,
      ...input,
    };

    const nodeMap = this.buildGraph();
    let currentNode: NodeType = "planner";
    let currentState = initialState;
    let recursionCount = 0;
    const recursionLimit = 50;

    while (currentNode !== "END" && recursionCount < recursionLimit) {
      const nodeFunction = nodeMap.get(currentNode);
      if (!nodeFunction) {
        throw new Error(`Node ${currentNode} not found in graph`);
      }

      const command = await nodeFunction(currentState);

      // Update state immutably
      currentState = {
        ...currentState,
        ...command.update,
      };

      // Set next node based on command type
      if (command.type === "end") {
        currentNode = "END";
      } else {
        currentNode = command.destination;
      }

      recursionCount++;
    }

    return {
      chatHistory: currentState.chatHistory,
      rca: currentState.rootCauseAnalysis,
    };
  }
}

const parseArgs = () => {
  const argsSchema = z.object({
    orgId: z.string().optional(),
    integration: z.enum(["datadog", "grafana"]).default("grafana"),
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

async function main() {
  const { integration, features: observabilityFeatures } = parseArgs();
  const integrationType =
    integration === "datadog" ? IntegrationType.DATADOG : IntegrationType.GRAFANA;

  const observabilityPlatform = getObservabilityPlatform(integrationType);

  // Get formatted labels map for time range
  const startDate = new Date("2025-03-03T03:00:00");
  const endDate = new Date("2025-03-03T03:30:00");
  const labelsMap = await observabilityPlatform.getLogsFacetValues(
    startDate.toISOString(),
    endDate.toISOString()
  );
  logger.info(labelsMap);

  const repoPath = "/Users/luketchang/code/ticketing";

  // Load or generate the codebase overview
  const overviewPath = "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md";

  let overview = "";
  try {
    overview = await fs.readFile(overviewPath, "utf-8");
  } catch (error) {
    console.error("Failed to load codebase overview:", error);
    overview = "Codebase overview not available";
  }

  const fileTree = loadFileTree(repoPath);

  const query = `Getting some "order not found" errors in the payments service which is causing crashes. One of these happened around 03-06-2025 around 4am UTC. Why is this happening? DO NOT USE SPAN SEARCH, NOT ALLOWED.`;

  const state: OncallAgentState = {
    firstPass: true,
    query,
    repoPath,
    codebaseOverview: overview,
    fileTree,
    labelsMap,
    chatHistory: [],
    codeContext: {},
    logContext: {},
    spanContext: {},
    rootCauseAnalysis: null,
    codeRequest: null,
    spanRequest: null,
    logRequest: null,
  };

  const reasoningModel = OpenAIModel.O3_MINI;
  const fastModel = AnthropicModel.CLAUDE_3_7_SONNET_20250219;

  logger.info(`Observability features: ${observabilityFeatures}`);

  const agent = new OnCallAgent(
    reasoningModel,
    fastModel,
    observabilityPlatform,
    observabilityFeatures
  );
  const response = await agent.invoke(state);
  logger.info(`Chat History: ${response.chatHistory}`);
  logger.info(`RCA: ${response.rca}`);
}

void main()
  // eslint-disable-next-line no-process-exit
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error in main:", error);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  });

// Agent package exports
export * from "./types";

// Export nodes
export * from "./nodes/planner";
export * from "./nodes/reasoner";
export * from "./nodes/reviewer";
export * from "./nodes/search/code-search";
export * from "./nodes/search/log-search";
export * from "./nodes/search/span-search";
export * from "./nodes/utils";
