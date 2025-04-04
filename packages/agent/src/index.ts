import { GeminiModel, loadFileTree, logger, Model, OpenAIModel } from "@triage/common";
import {
  getObservabilityPlatform,
  IntegrationType,
  Log,
  ObservabilityPlatform,
  Span,
} from "@triage/observability";
import { Command as CommanderCommand } from "commander";
import fs from "fs/promises";
import { z } from "zod";
import { Planner } from "./nodes/planner";
import { CodePostprocessor } from "./nodes/postprocessing/code-postprocessing";
import { LogPostprocessor } from "./nodes/postprocessing/log-postprocessing";
import { Reasoner } from "./nodes/reasoner";
import { Reviewer } from "./nodes/reviewer";
import { CodeSearch } from "./nodes/search/code-search";
import { LogSearchAgent } from "./nodes/search/log-search";
import { SpanSearchAgent } from "./nodes/search/span-search";
import { formatLogQuery } from "./nodes/utils";
import { CodePostprocessing, LogPostprocessing, LogSearchInput, SpanSearchInput } from "./types";

// Type definitions
type NodeType =
  | "planner"
  | "spanSearch"
  | "logSearch"
  | "codeSearch"
  | "reasoner"
  | "reviewer"
  | "logPostprocessor"
  | "codePostprocessor"
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
  codebaseSourceCode: string;
  fileTree: string;
  logLabelsMap: string;
  spanLabelsMap: string;
  chatHistory: string[];
  codeContext: Map<string, string>;
  logContext: Map<LogSearchInput, Log[] | string>;
  spanContext: Map<SpanSearchInput, Span[]>;
  logPostprocessingResult: LogPostprocessing | null;
  codePostprocessingResult: CodePostprocessing | null;
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
      logLabelsMap: state.logLabelsMap,
      spanLabelsMap: state.spanLabelsMap,
    });

    return {
      type: "next",
      destination: "spanSearch",
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

    const logSearchAgent = new LogSearchAgent(
      this.fastModel,
      this.reasoningModel,
      this.observabilityPlatform
    );
    const response = await logSearchAgent.invoke({
      query: state.query,
      logRequest: state.logRequest ?? "",
      logLabelsMap: state.logLabelsMap,
      logResultHistory: state.logContext,
    });

    if (state.firstPass) {
      return {
        type: "next",
        destination: "reasoner",
        update: {
          logContext: new Map([...state.logContext, ...response.newLogContext]),
          chatHistory: [...state.chatHistory, response.summary],
        },
      };
    }

    return {
      type: "next",
      destination: "reasoner",
      update: {
        logContext: new Map([...state.logContext, ...response.newLogContext]),
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
          destination: "logSearch",
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
      spanLabelsMap: state.spanLabelsMap,
      chatHistory: state.chatHistory,
    });

    if (state.firstPass) {
      return {
        type: "next",
        destination: "logSearch",
        update: {
          spanContext: new Map([...state.spanContext, ...response.newSpanContext]),
          chatHistory: [...state.chatHistory, response.summary],
        },
      };
    }

    return {
      type: "next",
      destination: "reasoner",
      update: {
        spanContext: new Map([...state.spanContext, ...response.newSpanContext]),
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
      logContext: state.logContext,
    });

    return {
      type: "next",
      destination: "reasoner",
      update: {
        chatHistory: [...state.chatHistory, response.summary],
        codeContext: new Map([...state.codeContext, ...response.newFilesRead]),
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
      codebaseSourceCode: state.codebaseSourceCode,
      logContext: state.logContext,
      spanContext: state.spanContext,
      logLabelsMap: state.logLabelsMap,
      spanLabelsMap: state.spanLabelsMap,
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
      logLabelsMap: state.logLabelsMap,
      spanLabelsMap: state.spanLabelsMap,
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
        type: "next",
        destination: "logPostprocessor",
        update: {
          chatHistory: [...state.chatHistory, response.reasoning],
        },
      };
    }
  }

  async postprocessLogs(state: OncallAgentState): Promise<Command> {
    logger.info("\n\n" + "=".repeat(25) + " Postprocess Logs " + "=".repeat(25));
    const postprocessor = new LogPostprocessor(this.reasoningModel);
    const response = await postprocessor.invoke({
      query: state.query,
      codebaseOverview: state.codebaseOverview,
      logLabelsMap: state.logLabelsMap,
      logContext: state.logContext,
      answer: state.rootCauseAnalysis ?? "",
    });

    logger.info(`Log postprocessing summary: ${response.summary}`);
    logger.info(
      `Log postprocessing relevant queries: ${response.relevantQueries
        .map(formatLogQuery)
        .join("\n\n")}`
    );

    return {
      type: "next",
      destination: "codePostprocessor",
      update: {
        logPostprocessingResult: response,
      },
    };
  }

  async postprocessCode(state: OncallAgentState): Promise<Command> {
    logger.info("\n\n" + "=".repeat(25) + " Postprocess Code " + "=".repeat(25));
    const postprocessor = new CodePostprocessor(this.reasoningModel);
    const response = await postprocessor.invoke({
      query: state.query,
      codebaseOverview: state.codebaseOverview,
      codeContext: state.codeContext,
      answer: state.rootCauseAnalysis ?? "",
    });

    logger.info(`Code postprocessing summary: ${response.summary}`);
    logger.info(`Code postprocessing relevant filepaths: ${response.relevantFilepaths}`);

    return {
      type: "end",
      update: {
        codePostprocessingResult: response,
      },
    };
  }

  buildGraph(): Map<NodeType, (state: OncallAgentState) => Promise<Command> | Command> {
    const nodeMap = new Map<NodeType, (state: OncallAgentState) => Promise<Command> | Command>();

    nodeMap.set("planner", this.plan.bind(this));
    nodeMap.set("spanSearch", this.spanSearch.bind(this));
    nodeMap.set("logSearch", this.logSearch.bind(this));
    nodeMap.set("codeSearch", this.codeSearch.bind(this));
    nodeMap.set("reasoner", this.reason.bind(this));
    nodeMap.set("reviewer", this.review.bind(this));
    nodeMap.set("logPostprocessor", this.postprocessLogs.bind(this));
    nodeMap.set("codePostprocessor", this.postprocessCode.bind(this));

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
      codebaseSourceCode: "",
      fileTree: "",
      logLabelsMap: "",
      spanLabelsMap: "",
      chatHistory: [],
      codeContext: new Map(),
      logContext: new Map(),
      spanContext: new Map(),
      logPostprocessingResult: null,
      codePostprocessingResult: null,
      rootCauseAnalysis: null,
      ...input,
    };

    const nodeMap = this.buildGraph();
    let currentNode: NodeType = "logSearch";
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
  const startDate = new Date("2025-04-01T21:00:00Z");
  const endDate = new Date("2025-04-01T22:00:00Z");

  // TODO: make this Map<string, string[]>
  const logLabelsMap = await observabilityPlatform.getLogsFacetValues(
    startDate.toISOString(),
    endDate.toISOString()
  );
  logger.info(logLabelsMap);

  // const spanLabelsMap = await observabilityPlatform.getSpansFacetValues(
  //   startDate.toISOString(),
  //   endDate.toISOString()
  // );
  // logger.info(spanLabelsMap);

  const repoPath = "/Users/luketchang/code/ticketing";

  // Load or generate the codebase overview
  const overviewPath = "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md";
  const sourceCodePath =
    "/Users/luketchang/code/triage/repos/ticketing/source-code/order-cancelled-publish-bug.txt";
  const bugPath =
    "/Users/luketchang/code/triage/repos/ticketing/bugs/order-cancelled-publish-bug.txt";

  const overview = await fs.readFile(overviewPath, "utf-8");
  const sourceCode = await fs.readFile(sourceCodePath, "utf-8");
  const bug = await fs.readFile(bugPath, "utf-8");

  const fileTree = loadFileTree(repoPath);

  const state: OncallAgentState = {
    firstPass: true,
    query: bug,
    repoPath,
    codebaseOverview: overview,
    codebaseSourceCode: sourceCode,
    fileTree,
    logLabelsMap,
    spanLabelsMap: "",
    chatHistory: [],
    codeContext: new Map(),
    logContext: new Map(),
    spanContext: new Map(),
    rootCauseAnalysis: null,
    codeRequest: null,
    spanRequest: null,
    logRequest: null,
    logPostprocessingResult: null,
    codePostprocessingResult: null,
  };

  const reasoningModel = GeminiModel.GEMINI_2_5_PRO;
  const fastModel = OpenAIModel.GPT_4O;

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
