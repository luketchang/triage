import fs from "fs/promises";

import { collectSourceCode, GeminiModel, loadFileTree, logger, Model, timer } from "@triage/common";
import {
  getObservabilityPlatform,
  IntegrationType,
  LogsWithPagination,
  ObservabilityPlatform,
  SpansWithPagination,
} from "@triage/observability";
import { Command as CommanderCommand } from "commander";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { CodePostprocessor } from "./nodes/postprocessing/code-postprocessing";
import { LogPostprocessor } from "./nodes/postprocessing/log-postprocessing";
import { Reasoner } from "./nodes/reasoner";
import { Reviewer } from "./nodes/reviewer";
import { LogSearchAgent } from "./nodes/search/log-search";
import { formatFacetValues } from "./nodes/utils";
import type { AgentStep, ChatMessage, CodePostprocessing, LogRequest, SpanRequest } from "./types";
import {
  AgentStreamUpdate,
  AssistantMessage,
  CodePostprocessingRequest,
  LogPostprocessing,
  LogPostprocessingRequest,
  LogSearchInputCore,
  ReasoningRequest,
  ReviewRequest,
  SpanSearchInputCore,
} from "./types";

const INITIAL_LOG_REQUEST: LogRequest = {
  type: "logRequest",
  request:
    "fetch logs relevant to the issue/event that will give you a full picture of the issue/event",
  reasoning: "",
};
const INITIAL_SPAN_REQUEST: SpanRequest = {
  type: "spanRequest",
  request:
    "fetch spans relevant to the issue/event that will give you a full picture of the issue/event",
  reasoning: "",
};

export interface TriageAgentState {
  firstPass: boolean;
  toolCalls: Array<
    | SpanRequest
    | LogRequest
    | ReasoningRequest
    | ReviewRequest
    | LogPostprocessingRequest
    | CodePostprocessingRequest
  >;
  query: string;
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  logLabelsMap: Map<string, string[]>;
  spanLabelsMap: Map<string, string[]>;
  chatHistory: ChatMessage[];
  agentSteps: AgentStep[];
  answer: string;
}

export class TriageAgent {
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

  @timer
  async processLogRequest(
    state: TriageAgentState,
    request: LogRequest,
    onUpdate?: (update: AgentStreamUpdate) => void
  ): Promise<Partial<TriageAgentState>> {
    logger.info("\n\n" + "=".repeat(25) + " Log Search " + "=".repeat(25));

    const logSearchId = uuidv4();

    if (onUpdate) {
      onUpdate({ type: "highLevelUpdate", id: logSearchId, stepType: "logSearch" });
    }

    if (!this.observabilityFeatures.includes("logs")) {
      logger.info("Log search not enabled, skipping");
      return {};
    }

    const logSearchAgent = new LogSearchAgent(this.fastModel, this.observabilityPlatform);

    const logSearchSteps = state.agentSteps.filter((step) => step.type === "logSearch");

    const response = await logSearchAgent.invoke({
      logSearchId,
      query: state.query,
      logRequest: request.request,
      logLabelsMap: state.logLabelsMap,
      logSearchSteps,
      codebaseOverview: state.codebaseOverview,
      onUpdate,
    });

    // Check if this is the last tool call in queue and if so, add a reasoning call to the queue
    const updatedToolCalls = [...state.toolCalls];
    if (updatedToolCalls.length === 0) {
      updatedToolCalls.push({ type: "reasoningRequest" });
    }

    return {
      agentSteps: [...state.agentSteps, ...response.newLogSearchSteps],
    };
  }

  // @timer
  // async processSpanRequest(
  //   state: TriageAgentState,
  //   request: SpanRequest,
  //   onUpdate?: (update: AgentStreamUpdate) => void
  // ): Promise<Partial<TriageAgentState>> {
  //   logger.info("\n\n" + "=".repeat(25) + " Span Search " + "=".repeat(25));

  //   const spanSearchId = uuidv4();

  //   if (onUpdate) {
  //     onUpdate({ type: "highLevelUpdate", id: spanSearchId, stepType: "spanSearch" });
  //   }

  //   if (!this.observabilityFeatures.includes("spans")) {
  //     logger.info("Span search not enabled, skipping");
  //     return {};
  //   }

  //   const spanSearchAgent = new SpanSearchAgent(
  //     this.fastModel,
  //     this.reasoningModel,
  //     this.observabilityPlatform
  //   );

  //   const response = await spanSearchAgent.invoke({
  //     query: state.query,
  //     spanRequest: request.request,
  //     spanLabelsMap: state.spanLabelsMap,
  //     codebaseOverview: state.codebaseOverview,
  //   });

  //   // Check if this is the last tool call in queue and if so, add a reasoning call to the queue
  //   const updatedToolCalls = [...state.toolCalls];
  //   if (updatedToolCalls.length === 0) {
  //     updatedToolCalls.push({ type: "reasoningRequest" });
  //   }

  //   return {
  //     spanContext: new Map([...state.spanContext, ...response.newSpanContext]),
  //     chatHistory: [...state.chatHistory, response.summary],
  //     toolCalls: updatedToolCalls,
  //   };
  // }

  @timer
  async processReasoningRequest(
    state: TriageAgentState,
    onUpdate?: (update: AgentStreamUpdate) => void
  ): Promise<Partial<TriageAgentState>> {
    logger.info("\n\n" + "=".repeat(25) + " Reasoning " + "=".repeat(25));

    const reasoningId = uuidv4();

    if (onUpdate) {
      onUpdate({ type: "highLevelUpdate", id: reasoningId, stepType: "reasoning" });
    }

    const reasoner = new Reasoner(this.reasoningModel);
    const response = await reasoner.invoke({
      query: state.query,
      repoPath: state.repoPath,
      codebaseOverview: state.codebaseOverview,
      fileTree: state.fileTree,
      agentSteps: state.agentSteps,
      logLabelsMap: state.logLabelsMap,
      spanLabelsMap: state.spanLabelsMap,
      parentId: reasoningId,
      onUpdate,
    });

    logger.info(`Reasoning response: ${JSON.stringify(response)}`);

    // Define base updates
    const updates: Partial<TriageAgentState> = {
      firstPass: false,
    };

    if (response.type === "reasoning") {
      // TODO: pretty sure this should always hold
      if (state.toolCalls.length !== 0) {
        throw new Error("Tool calls should be empty");
      }

      updates.agentSteps = [...state.agentSteps, response];
      updates.toolCalls = [{ type: "reviewRequest" }];
    } else if (response.type === "toolCalls") {
      updates.toolCalls = [...state.toolCalls, ...response.toolCalls];
    }

    return updates;
  }

  @timer
  async processReviewRequest(
    state: TriageAgentState,
    onUpdate?: (update: AgentStreamUpdate) => void
  ): Promise<Partial<TriageAgentState>> {
    logger.info("\n\n" + "=".repeat(25) + " Review " + "=".repeat(25));

    const reviewId = uuidv4();

    if (onUpdate) {
      onUpdate({ type: "highLevelUpdate", id: reviewId, stepType: "review" });
    }

    const reviewer = new Reviewer(this.reasoningModel);
    const response = await reviewer.invoke({
      query: state.query,
      repoPath: state.repoPath,
      codebaseOverview: state.codebaseOverview,
      logLabelsMap: state.logLabelsMap,
      spanLabelsMap: state.spanLabelsMap,
      agentSteps: state.agentSteps,
      answer: state.answer,
      parentId: reviewId,
      onUpdate,
    });

    // Define base updates
    const updates: Partial<TriageAgentState> = {
      chatHistory: [...state.chatHistory],
    };

    if (response.type === "review") {
      // Add log and code post-processing requests to the queue
      const postProcessingCalls = [];
      if (this.observabilityFeatures.includes("logs")) {
        postProcessingCalls.push({ type: "logPostprocessing" } as LogPostprocessingRequest);
      }
      postProcessingCalls.push({ type: "codePostprocessing" } as CodePostprocessingRequest);

      updates.toolCalls = [...state.toolCalls, ...postProcessingCalls];
      updates.answer = response.content;
    } else if (response.type === "toolCalls") {
      updates.toolCalls = [...state.toolCalls, ...response.toolCalls];
    }

    return updates;
  }

  @timer
  async processLogPostprocessingRequest(
    state: TriageAgentState,
    onUpdate?: (update: AgentStreamUpdate) => void
  ): Promise<Partial<TriageAgentState>> {
    logger.info("\n\n" + "=".repeat(25) + " Postprocess Logs " + "=".repeat(25));

    const logPostprocessingId = uuidv4();

    if (onUpdate) {
      onUpdate({ type: "highLevelUpdate", id: logPostprocessingId, stepType: "logPostprocessing" });
    }

    const postprocessor = new LogPostprocessor(this.fastModel);
    const response = await postprocessor.invoke({
      query: state.query,
      codebaseOverview: state.codebaseOverview,
      logLabelsMap: state.logLabelsMap,
      logSearchSteps: state.agentSteps.filter((step) => step.type === "logSearch"),
      answer: state.answer,
      parentId: logPostprocessingId,
      onUpdate,
    });

    logger.info(`Log postprocessing complete with ${response.facts.length} relevant facts`);

    return {
      agentSteps: [...state.agentSteps, response],
    };
  }

  @timer
  async processCodePostprocessingRequest(
    state: TriageAgentState,
    onUpdate?: (update: AgentStreamUpdate) => void
  ): Promise<Partial<TriageAgentState>> {
    logger.info("\n\n" + "=".repeat(25) + " Postprocess Code " + "=".repeat(25));

    const codePostprocessingId = uuidv4();

    if (onUpdate) {
      onUpdate({
        type: "highLevelUpdate",
        id: codePostprocessingId,
        stepType: "codePostprocessing",
      });
    }

    const postprocessor = new CodePostprocessor(this.fastModel);
    const response = await postprocessor.invoke({
      query: state.query,
      codebaseOverview: state.codebaseOverview,
      codeSearchSteps: state.agentSteps.filter((step) => step.type === "codeSearch"),
      answer: state.answer,
      parentId: codePostprocessingId,
      onUpdate,
    });

    logger.info(`Code postprocessing complete with ${response.facts.length} relevant facts`);

    return {
      agentSteps: [...state.agentSteps, response],
    };
  }

  async invoke(
    state: TriageAgentState,
    options?: { onUpdate?: (update: AgentStreamUpdate) => void }
  ): Promise<AssistantMessage> {
    const { onUpdate } = options || {};
    let currentState = state;
    let iterationCount = 0;
    const maxIterations = 50;

    // Process tool calls from the queue until empty or max iterations reached
    let agentSteps: AgentStep[] = [];
    while (currentState.toolCalls.length > 0 && iterationCount < maxIterations) {
      // Get the next tool call from the queue
      const [nextToolCall, ...remainingCalls] = currentState.toolCalls;

      // Update the queue in the state
      currentState = {
        ...currentState,
        toolCalls: remainingCalls,
      };

      // Process the tool call based on its type
      let stateUpdates: Partial<TriageAgentState> = {};

      if (nextToolCall) {
        if (nextToolCall.type === "logRequest") {
          stateUpdates = await this.processLogRequest(currentState, nextToolCall, onUpdate);
          // } else if (nextToolCall.type === "spanRequest") {
          //   stateUpdates = await this.processSpanRequest(currentState, nextToolCall, onUpdate);
        } else if (nextToolCall.type === "reasoningRequest") {
          stateUpdates = await this.processReasoningRequest(currentState, onUpdate);
        } else if (nextToolCall.type === "reviewRequest") {
          stateUpdates = await this.processReviewRequest(currentState, onUpdate);
        } else if (nextToolCall.type === "logPostprocessing") {
          stateUpdates = await this.processLogPostprocessingRequest(currentState, onUpdate);
        } else if (nextToolCall.type === "codePostprocessing") {
          stateUpdates = await this.processCodePostprocessingRequest(currentState, onUpdate);
        }
      }

      // Update the state with the results
      currentState = {
        ...currentState,
        ...stateUpdates,
      };

      iterationCount++;
    }

    // Return the final results including post-processing
    return {
      role: "assistant",
      steps: currentState.agentSteps,
      response: currentState.answer,
      error: null,
    };
  }
}

/**
 * Arguments for invoking the agent
 */
export interface AgentArgs {
  query: string;
  repoPath: string;
  codebaseOverviewPath: string;
  observabilityPlatform?: string;
  observabilityFeatures?: string[];
  startDate?: Date;
  endDate?: Date;
  reasonOnly?: boolean;
  logContext?: Map<LogSearchInputCore, LogsWithPagination | string>;
  spanContext?: Map<SpanSearchInputCore, SpansWithPagination | string>;
  onUpdate?: (update: AgentStreamUpdate) => void;
}

/**
 * Result of agent invocation
 */
export interface AgentResult {
  chatHistory: string[];
  response: string | null;
  logPostprocessing: LogPostprocessing | null;
  codePostprocessing: CodePostprocessing | null;
  logContext: Map<LogSearchInputCore, LogsWithPagination | string>;
  codeContext: Map<string, string>;
}

/**
 * Invokes the agent with the given parameters
 */
export async function invokeAgent({
  query,
  repoPath,
  codebaseOverviewPath,
  observabilityPlatform: platformType = "grafana",
  observabilityFeatures = ["logs"],
  startDate = new Date("2025-04-01T21:00:00Z"),
  endDate = new Date("2025-04-01T22:00:00Z"),
  reasonOnly = false,
  logContext,
  spanContext,
  onUpdate,
}: AgentArgs): Promise<AssistantMessage> {
  // If reasonOnly is true, override observabilityFeatures to be empty
  if (reasonOnly) {
    observabilityFeatures = [];
  }

  const integrationType =
    platformType === "datadog" ? IntegrationType.DATADOG : IntegrationType.GRAFANA;

  const observabilityPlatform = getObservabilityPlatform(integrationType);

  // Get formatted labels map for time range
  const logLabelsMap = await observabilityPlatform.getLogsFacetValues(
    startDate.toISOString(),
    endDate.toISOString()
  );
  logger.info(formatFacetValues(logLabelsMap));

  // TODO: add back in once spans ready
  // const spanLabelsMap = await observabilityPlatform.getSpansFacetValues(
  //   startDate.toISOString(),
  //   endDate.toISOString()
  // );
  // logger.info(formatFacetValues(spanLabelsMap));

  const codeMap = collectSourceCode(repoPath);
  const initialAgentSteps: AgentStep[] = Object.entries(codeMap).map(([filepath, source]) => ({
    type: "codeSearch",
    timestamp: new Date(),
    filepath,
    source,
  }));

  // Load the codebase overview
  const overview = await fs.readFile(codebaseOverviewPath, "utf-8");

  const fileTree = loadFileTree(repoPath);

  let toolCalls: Array<
    | SpanRequest
    | LogRequest
    | ReasoningRequest
    | LogPostprocessingRequest
    | CodePostprocessingRequest
  > = [];
  if (observabilityFeatures.includes("logs")) {
    toolCalls.push(INITIAL_LOG_REQUEST);
  }

  // Add default span request if spans feature is enabled
  if (observabilityFeatures.includes("spans")) {
    toolCalls.push(INITIAL_SPAN_REQUEST);
  }

  // If no observability features are enabled, start with reasoning
  if (toolCalls.length === 0) {
    toolCalls.push({ type: "reasoningRequest" });
  }

  const state: TriageAgentState = {
    firstPass: true,
    toolCalls,
    query,
    repoPath,
    codebaseOverview: overview,
    fileTree,
    logLabelsMap,
    spanLabelsMap: new Map<string, string[]>(),
    chatHistory: [],
    agentSteps: initialAgentSteps,
    answer: "",
  };

  const reasoningModel = GeminiModel.GEMINI_2_5_PRO;
  const fastModel = GeminiModel.GEMINI_2_5_FLASH;

  logger.info(`Observability features: ${observabilityFeatures}`);

  const agent = new TriageAgent(
    reasoningModel,
    fastModel,
    observabilityPlatform,
    observabilityFeatures
  );

  return await agent.invoke(state, { onUpdate });
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
  const startDate = new Date("2025-04-16T21:00:00Z");
  const endDate = new Date("2025-04-16T23:00:00Z");

  const repoPath = "/Users/luketchang/code/ticketing";

  // Load or generate the codebase overview
  const overviewPath = "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md";
  const bugPath = "/Users/luketchang/code/triage/repos/ticketing/bugs/rabbitmq-bug.txt";

  const bug = await fs.readFile(bugPath, "utf-8");

  // Use invokeAgent instead of duplicating the logic
  const response = await invokeAgent({
    query: bug,
    repoPath,
    codebaseOverviewPath: overviewPath,
    observabilityPlatform: integration,
    observabilityFeatures,
    startDate,
    endDate,
    onUpdate: (update) => {
      if (update.type === "highLevelUpdate") {
        logger.info(`HighLevelUpdate: ${update.stepType}`);
      } else if (update.type === "intermediateUpdate") {
        logger.info(`IntermediateUpdate: ${update.step.type}`);
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
export * from "./nodes/reasoner";
export * from "./nodes/reviewer";
export * from "./nodes/search/log-search";
export * from "./nodes/search/span-search";
export * from "./nodes/utils";
export * from "./types";
