import { logger, timer } from "@triage/common";
import { generateText } from "ai";
import { v4 as uuidv4 } from "uuid";

import { TriagePipelineConfig } from "../pipeline";
import {
  CatStep,
  CodePostprocessingStep,
  PipelineStateManager,
  StepsType,
} from "../pipeline/state";
import { codePostprocessingToolSchema } from "../types";

import { ensureSingleToolCall, formatCatSteps, normalizeFilePath } from "./utils";

const SYSTEM_PROMPT = `
You are an expert AI assistant that assists engineers debugging production issues. You specifically review answers to user queries (about a potential issue/event) and gather supporting context from code.
`;

function createPrompt(params: {
  query: string;
  repoPath: string;
  codebaseOverview: string;
  catSteps: CatStep[];
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
  ${params.query}
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
  ${formatCatSteps(params.catSteps, { lineNumbers: true })}
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
    const codePostprocessingId = uuidv4();
    this.state.recordHighLevelStep("codePostprocessing", codePostprocessingId);

    const prompt = createPrompt({
      query: this.config.query,
      repoPath: this.config.repoPath,
      codebaseOverview: this.config.codebaseOverview,
      catSteps: this.state.getCatSteps(StepsType.CURRENT),
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

    this.state.addIntermediateStep(
      {
        type: "codePostprocessing",
        facts: normalizedFacts,
        timestamp: new Date(),
      },
      codePostprocessingId
    );

    return {
      type: "codePostprocessing",
      timestamp: new Date(),
      facts: normalizedFacts,
    };
  }
}
