import fs from "fs/promises";

import { GeminiModel, loadFileTree, logger, Model, timer } from "@triage/common";
import {
  getObservabilityPlatform,
  IntegrationType,
  ObservabilityPlatform,
} from "@triage/observability";
import { Command as CommanderCommand } from "commander";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { CodePostprocessor } from "./nodes/postprocessing/code-postprocessing";
import { LogPostprocessor } from "./nodes/postprocessing/log-postprocessing";
import { Reasoner } from "./nodes/reasoner";
import { Reviewer } from "./nodes/reviewer";
import { CodeSearchAgent } from "./nodes/search/code-search";
import { LogSearchAgent } from "./nodes/search/log-search";
import { formatFacetValues } from "./nodes/utils";
import type { AgentStep, ChatMessage, CodeRequest, LogRequest, SpanRequest } from "./types";
import {
  AgentStreamUpdate,
  AssistantMessage,
  CodePostprocessingRequest,
  LogPostprocessingRequest,
  ReasoningRequest,
  ReviewRequest,
} from "./types";

const INITIAL_LOG_REQUEST: LogRequest = {
  type: "logRequest",
  request:
    "fetch logs relevant to the issue/event that will give you a full picture of the issue/event",
  reasoning: "",
};
const INITIAL_CODE_REQUEST: CodeRequest = {
  type: "codeRequest",
  request:
    "fetch code relevant to the issue/event that will give you a full picture of the issue/event",
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
    | LogRequest
    | CodeRequest
    | SpanRequest
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

    // Get logSearch steps from both chatHistory (past interactions) and current agentSteps
    const historyLogSearchSteps = state.chatHistory.flatMap((msg) => {
      if (msg.role === "assistant" && "steps" in msg) {
        return msg.steps.filter((step) => step.type === "logSearch");
      }
      return [];
    });
    const currentLogSearchSteps = state.agentSteps.filter((step) => step.type === "logSearch");
    const logSearchSteps = [...historyLogSearchSteps, ...currentLogSearchSteps];

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
      toolCalls: updatedToolCalls,
    };
  }

  @timer
  async processCodeRequest(
    state: TriageAgentState,
    request: CodeRequest,
    onUpdate?: (update: AgentStreamUpdate) => void
  ): Promise<Partial<TriageAgentState>> {
    logger.info("\n\n" + "=".repeat(25) + " Code Search " + "=".repeat(25));

    const codeSearchId = uuidv4();

    if (onUpdate) {
      onUpdate({ type: "highLevelUpdate", id: codeSearchId, stepType: "codeSearch" });
    }

    const codeSearchAgent = new CodeSearchAgent(this.fastModel);

    // Get codeSearch steps from both chatHistory (past interactions) and current agentSteps
    const historyCodeSearchSteps = state.chatHistory.flatMap((msg) => {
      if (msg.role === "assistant" && "steps" in msg) {
        return msg.steps.filter((step) => step.type === "codeSearch");
      }
      return [];
    });
    const currentCodeSearchSteps = state.agentSteps.filter((step) => step.type === "codeSearch");
    const codeSearchSteps = [...historyCodeSearchSteps, ...currentCodeSearchSteps];

    const response = await codeSearchAgent.invoke({
      query: state.query,
      codeRequest: request.request,
      repoPath: state.repoPath,
      codeSearchId,
      codeSearchSteps,
      onUpdate,
    });

    const updatedToolCalls = [...state.toolCalls];
    if (updatedToolCalls.length === 0) {
      updatedToolCalls.push({ type: "reasoningRequest" });
    }

    logger.info(`added ${response.newCodeSearchSteps.length} code search steps`);

    return {
      agentSteps: [...state.agentSteps, ...response.newCodeSearchSteps],
      toolCalls: updatedToolCalls,
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
    logger.info(`Chat history: ${JSON.stringify(state.chatHistory)}`);
    const response = await reasoner.invoke({
      query: state.query,
      chatHistory: state.chatHistory,
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
      updates.answer = response.content;
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
      chatHistory: state.chatHistory,
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
    } else if (response.type === "toolCalls") {
      updates.answer = undefined;
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
    const logSearchSteps = state.agentSteps.filter((step) => step.type === "logSearch");
    const response = await postprocessor.invoke({
      query: state.query,
      codebaseOverview: state.codebaseOverview,
      logLabelsMap: state.logLabelsMap,
      logSearchSteps,
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

    const codeSearchSteps = state.agentSteps.filter((step) => step.type === "codeSearch");
    const response = await postprocessor.invoke({
      query: state.query,
      codebaseOverview: state.codebaseOverview,
      codeSearchSteps,
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
        } else if (nextToolCall.type === "codeRequest") {
          stateUpdates = await this.processCodeRequest(currentState, nextToolCall, onUpdate);
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

  // Load the codebase overview
  const overview = await fs.readFile(codebaseOverviewPath, "utf-8");

  const fileTree = loadFileTree(repoPath);

  let toolCalls: Array<
    | LogRequest
    | CodeRequest
    | SpanRequest
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

  toolCalls.push(INITIAL_CODE_REQUEST);

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
    chatHistory,
    agentSteps: [],
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
  const startDate = new Date("2025-05-02T02:00:00Z");
  const endDate = new Date("2025-05-02T03:00:00Z");

  const repoPath = "/Users/luketchang/code/ticketing";

  // Load or generate the codebase overview
  const overviewPath = "/Users/luketchang/code/triage/repos/ticketing/codebase-analysis.md";
  const bugPath = "/Users/luketchang/code/triage/repos/ticketing/bugs/rabbitmq-bug.txt";

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
        if (update.step.type === "reasoning") {
          process.stdout.write(`${update.step.contentChunk}\n`);
        } else if (update.step.type === "review") {
          process.stdout.write(`${update.step.contentChunk}\n`);
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
export * from "./nodes/reasoner";
export * from "./nodes/reviewer";
export * from "./nodes/search/log-search";
export * from "./nodes/search/span-search";
export * from "./nodes/utils";
export * from "./types";
