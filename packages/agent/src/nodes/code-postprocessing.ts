import { logger, timer } from "@triage/common";
import { generateText } from "ai";
import { v4 as uuidv4 } from "uuid";

import { TriagePipelineConfig } from "../pipeline";
import { CatToolCallWithResult, CodePostprocessingStep, StepsType } from "../pipeline/state";
import { PipelineStateManager } from "../pipeline/state-manager";
import { codePostprocessingToolSchema, UserMessage } from "../types";
import {
  ensureSingleToolCall,
  formatCatToolCallsWithResults,
  formatUserMessage,
  normalizeFilePath,
} from "../utils";

const SYSTEM_PROMPT = `
You are an expert AI assistant that assists engineers debugging production issues. You specifically review answers to user queries (about a potential issue/event) and gather supporting context from code.
`;

function createPrompt(params: {
  userMessage: UserMessage;
  repoPath: string;
  codebaseOverview: string;
  catToolCallsWithResults: CatToolCallWithResult[];
  answer: string;
}): string {
  return `
  Given the user query, the proposed answer/analysis, an overview of the codebase, and previously gathered code context, your task is to pull out key/relevant facts from the code context that support the answer along with citations for the facts. Examples of key facts might include a specific region of code that has a bug, a code section that is related to the issue, etc. Citations consist of a block of code and the file path for that code block.

  Rules:
  - A code postprocessing tool call will specify a list of facts. Each fact will have a fact description and a reference to a code block via a filepath and set of start/end line numbers.
  - You must output a single code postprocessing tool call. A code postprocessing tool call may list multiple facts. DO NOT output multiple tool calls.

  Tips:
  - Do not give references for code "fixes" only reference existing code that is in the previous code context.

  <query>
  ${formatUserMessage(params.userMessage)}
  </query>

  <answer>
  ${params.answer}
  </answer>

  <codebase_overview>
  ${params.codebaseOverview}
  </codebase_overview>

  <repo_path>
  ${params.repoPath}
  </repo_path>
  
  <previous_code_context>
  ${formatCatToolCallsWithResults(params.catToolCallsWithResults, { lineNumbers: true })}
  </previous_code_context>
  `;
}

export class CodePostprocessor {
  private config: Readonly<TriagePipelineConfig>;
  private state: PipelineStateManager;

  constructor(config: Readonly<TriagePipelineConfig>, state: PipelineStateManager) {
    this.config = config;
    this.state = state;
  }

  @timer
  async invoke(): Promise<CodePostprocessingStep> {
    logger.info("\n\n" + "=".repeat(25) + " Postprocess Code " + "=".repeat(25));

    const stepId = uuidv4();

    // Send initial update with empty data
    const initialStep: CodePostprocessingStep = {
      id: stepId,
      type: "codePostprocessing",
      timestamp: new Date(),
      data: [],
    };
    this.state.addUpdate(initialStep);

    const prompt = createPrompt({
      userMessage: this.config.userMessage,
      repoPath: this.config.repoPath,
      codebaseOverview: this.config.codebaseOverview,
      catToolCallsWithResults: this.state.getCatToolCallsWithResults(StepsType.CURRENT),
      answer: this.state.getAnswer()!,
    });

    logger.info(`Code postprocessing prompt:\n${prompt}`);

    const { toolCalls } = await generateText({
      model: this.config.fastClient,
      system: SYSTEM_PROMPT,
      prompt: prompt,
      tools: {
        codePostprocessing: codePostprocessingToolSchema,
      },
      toolChoice: "required",
      abortSignal: this.config.abortSignal,
    });

    let toolCall;
    if (toolCalls.length > 1) {
      logger.warn("Multiple tool calls detected, merging results");
      toolCall = {
        args: {
          facts: toolCalls.flatMap((call) => call.args.facts || []),
        },
      };
    } else {
      toolCall = ensureSingleToolCall(toolCalls);
    }

    // Normalize filepaths in each fact
    const normalizedFacts =
      toolCall.args.facts?.map((fact) => ({
        ...fact,
        filepath: normalizeFilePath(fact.filepath, this.config.repoPath),
      })) || [];

    // Send second update with populated data
    const finalStep: CodePostprocessingStep = {
      id: stepId,
      type: "codePostprocessing",
      timestamp: new Date(),
      data: normalizedFacts,
    };

    this.state.addUpdate(finalStep);

    return finalStep;
  }
}
