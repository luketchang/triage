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
import { CodePostprocessor } from "./nodes/postprocessing/code-postprocessing";
import { LogPostprocessor } from "./nodes/postprocessing/log-postprocessing";
import { Reasoner } from "./nodes/reasoner";
import { Reviewer } from "./nodes/reviewer";
import { LogSearchAgent } from "./nodes/search/log-search";
import { SpanSearchAgent } from "./nodes/search/span-search";
import { formatLogQuery } from "./nodes/utils";
import {
  CodePostprocessing,
  CodePostprocessingRequest,
  LogPostprocessing,
  LogPostprocessingRequest,
  LogRequest,
  LogSearchInput,
  ReasoningRequest,
  ReviewRequest,
  SpanRequest,
  SpanSearchInput,
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

// Type definitions
type NodeType =
  | "spanSearch"
  | "logSearch"
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

  async processLogRequest(
    state: OncallAgentState,
    request: LogRequest
  ): Promise<Partial<OncallAgentState>> {
    logger.info("\n\n" + "=".repeat(25) + " Log Search " + "=".repeat(25));

    if (!this.observabilityFeatures.includes("logs")) {
      logger.info("Log search not enabled, skipping");
      return {};
    }

    const logSearchAgent = new LogSearchAgent(
      this.fastModel,
      this.reasoningModel,
      this.observabilityPlatform
    );

    const response = await logSearchAgent.invoke({
      query: state.query,
      logRequest: request.request,
      logLabelsMap: state.logLabelsMap,
      logResultHistory: state.logContext,
    });

    // Check if this is the last tool call in queue and if so, add a reasoning call to the queue
    const updatedToolCalls = [...state.toolCalls];
    if (updatedToolCalls.length === 0) {
      updatedToolCalls.push({ type: "reasoningRequest" });
    }

    return {
      logContext: new Map([...state.logContext, ...response.newLogContext]),
      chatHistory: [...state.chatHistory, response.summary],
      toolCalls: updatedToolCalls,
    };
  }

  async processSpanRequest(
    state: OncallAgentState,
    request: SpanRequest
  ): Promise<Partial<OncallAgentState>> {
    logger.info("\n\n" + "=".repeat(25) + " Span Search " + "=".repeat(25));

    if (!this.observabilityFeatures.includes("spans")) {
      logger.info("Span search not enabled, skipping");
      return {};
    }

    const spanSearchAgent = new SpanSearchAgent(
      this.fastModel,
      this.reasoningModel,
      this.observabilityPlatform
    );

    const response = await spanSearchAgent.invoke({
      query: state.query,
      spanRequest: request.request,
      spanLabelsMap: state.spanLabelsMap,
      chatHistory: state.chatHistory,
    });

    // Check if this is the last tool call in queue and if so, add a reasoning call to the queue
    const updatedToolCalls = [...state.toolCalls];
    if (updatedToolCalls.length === 0) {
      updatedToolCalls.push({ type: "reasoningRequest" });
    }

    return {
      spanContext: new Map([...state.spanContext, ...response.newSpanContext]),
      chatHistory: [...state.chatHistory, response.summary],
      toolCalls: updatedToolCalls,
    };
  }

  async processReasoningRequest(state: OncallAgentState): Promise<Partial<OncallAgentState>> {
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
      logLabelsMap: state.logLabelsMap,
      spanLabelsMap: state.spanLabelsMap,
    });

    logger.info(`Reasoning response: ${JSON.stringify(response)}`);

    // Define base updates
    const updates: Partial<OncallAgentState> = {
      firstPass: false,
    };

    if (response.type === "rootCauseAnalysis") {
      // Add to chat history the root cause and set it in state
      updates.rootCauseAnalysis = response.rootCause;
      updates.chatHistory = [...state.chatHistory, response.rootCause];

      // TODO: pretty sure this should always hold
      if (state.toolCalls.length !== 0) {
        throw new Error("Tool calls should be empty");
      }
      updates.toolCalls = [{ type: "reviewRequest" }];
    } else if (response.type === "toolCalls") {
      // Add reasoning summary to chat history (will need to create if it doesn't exist)
      const reasoning = response.toolCalls
        .map((toolCall) => (toolCall as LogRequest | SpanRequest).reasoning)
        .join("\n\n");
      updates.chatHistory = [...state.chatHistory, reasoning];
      updates.toolCalls = [...state.toolCalls, ...response.toolCalls];
    }

    return updates;
  }

  async processReviewRequest(state: OncallAgentState): Promise<Partial<OncallAgentState>> {
    logger.info("\n\n" + "=".repeat(25) + " Review " + "=".repeat(25));
    const reviewer = new Reviewer(this.reasoningModel);
    const response = await reviewer.invoke({
      query: state.query,
      repoPath: state.repoPath,
      codebaseOverview: state.codebaseOverview,
      logLabelsMap: state.logLabelsMap,
      spanLabelsMap: state.spanLabelsMap,
      chatHistory: state.chatHistory,
      codeContext: state.codeContext,
      logContext: state.logContext,
      rootCauseAnalysis: state.rootCauseAnalysis ?? "",
    });

    // Define base updates
    const updates: Partial<OncallAgentState> = {
      chatHistory: [...state.chatHistory],
    };

    if (response.type === "rootCauseAnalysis") {
      // The review has confirmed the root cause analysis, proceed to postprocessing
      logger.info("Reviewer confirmed root cause analysis");

      // Add log and code post-processing requests to the queue
      const postProcessingCalls = [];
      if (this.observabilityFeatures.includes("logs")) {
        postProcessingCalls.push({ type: "logPostprocessing" } as LogPostprocessingRequest);
      }
      postProcessingCalls.push({ type: "codePostprocessing" } as CodePostprocessingRequest);

      updates.toolCalls = [...state.toolCalls, ...postProcessingCalls];
    } else if (response.type === "toolCalls") {
      // Add reasoning message to chat history
      const reasoningSummary = response.toolCalls
        .map((toolCall) => (toolCall as LogRequest | SpanRequest).reasoning)
        .join("\n\n");
      updates.chatHistory = [...state.chatHistory, reasoningSummary];
      updates.toolCalls = [...state.toolCalls, ...response.toolCalls];
    }

    return updates;
  }

  async processLogPostprocessingRequest(
    state: OncallAgentState
  ): Promise<Partial<OncallAgentState>> {
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
      logPostprocessingResult: response,
    };
  }

  async processCodePostprocessingRequest(
    state: OncallAgentState
  ): Promise<Partial<OncallAgentState>> {
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
      codePostprocessingResult: response,
    };
  }

  async invoke(state: OncallAgentState): Promise<{
    chatHistory: string[];
    rca: string | null;
    logPostprocessing: LogPostprocessing | null;
    codePostprocessing: CodePostprocessing | null;
  }> {
    let currentState = state;
    let iterationCount = 0;
    const maxIterations = 50;

    // Process tool calls from the queue until empty or max iterations reached
    while (currentState.toolCalls.length > 0 && iterationCount < maxIterations) {
      // Get the next tool call from the queue
      const [nextToolCall, ...remainingCalls] = currentState.toolCalls;

      // Update the queue in the state
      currentState = {
        ...currentState,
        toolCalls: remainingCalls,
      };

      // Process the tool call based on its type
      let stateUpdates: Partial<OncallAgentState> = {};

      if (nextToolCall) {
        if (nextToolCall.type === "logRequest") {
          stateUpdates = await this.processLogRequest(currentState, nextToolCall);
        } else if (nextToolCall.type === "spanRequest") {
          stateUpdates = await this.processSpanRequest(currentState, nextToolCall);
        } else if (nextToolCall.type === "reasoningRequest") {
          stateUpdates = await this.processReasoningRequest(currentState);
        } else if (nextToolCall.type === "reviewRequest") {
          stateUpdates = await this.processReviewRequest(currentState);
        } else if (nextToolCall.type === "logPostprocessing") {
          stateUpdates = await this.processLogPostprocessingRequest(currentState);
        } else if (nextToolCall.type === "codePostprocessing") {
          stateUpdates = await this.processCodePostprocessingRequest(currentState);
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
      chatHistory: currentState.chatHistory,
      rca: currentState.rootCauseAnalysis,
      logPostprocessing: currentState.logPostprocessingResult,
      codePostprocessing: currentState.codePostprocessingResult,
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
  const sourceCodeJsonPath =
    "/Users/luketchang/code/triage/repos/ticketing/source-code/rabbitmq-bug.json";
  const bugPath = "/Users/luketchang/code/triage/repos/ticketing/bugs/rabbitmq-bug.txt";

  const overview = await fs.readFile(overviewPath, "utf-8");

  // Load code context from JSON file
  const sourceCodeJson = await fs.readFile(sourceCodeJsonPath, "utf-8");
  const codeContext = new Map<string, string>(Object.entries(JSON.parse(sourceCodeJson)));

  const bug = await fs.readFile(bugPath, "utf-8");

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
  // TODO: is this the behavior we want?
  if (toolCalls.length === 0) {
    toolCalls.push({ type: "reasoningRequest" });
  }

  const state: OncallAgentState = {
    firstPass: true,
    toolCalls,
    query: bug,
    repoPath,
    codebaseOverview: overview,
    fileTree,
    logLabelsMap,
    spanLabelsMap: "",
    chatHistory: [],
    codeContext,
    logContext: new Map(),
    spanContext: new Map(),
    rootCauseAnalysis: null,
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
  logger.info(`Log Post-processing: ${JSON.stringify(response.logPostprocessing)}`);
  logger.info(`Code Post-processing: ${JSON.stringify(response.codePostprocessing)}`);
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
export * from "./nodes/reasoner";
export * from "./nodes/reviewer";
export * from "./nodes/search/log-search";
export * from "./nodes/search/span-search";
export * from "./nodes/utils";
export * from "./types";
