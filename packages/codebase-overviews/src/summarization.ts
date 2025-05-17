import { logger } from "@triage/common";
import { generateText, LanguageModelV1 } from "ai";

import { MERGE_SUMMARIES_EXAMPLE } from "./examples/merge-summaries-example";

/**
 * System prompt specific to the code summarization tasks
 */
export const SUMMARIZATION_SYSTEM_PROMPT = `
You are an expert AI assistant that helps analyze codebases and generate comprehensive technical overviews. 
Your task is to generate detailed summaries of code components and create a unified walkthrough of the entire system.
`;

/**
 * Generates a prompt for directory summary
 */
export function createDirectorySummaryPrompt(params: {
  systemDescription: string;
  repoFileTree: string;
  directory: string;
  dirFileTree: string;
  fileContents: Record<string, string>;
}): string {
  let fileContentsStr = "";
  for (const [path, content] of Object.entries(params.fileContents)) {
    fileContentsStr += `\nFile: ${path}\n${"-".repeat(40)}\n${content}\n${"-".repeat(40)}\n`;
  }

  return `
Your task is to create a comprehensive, detailed analysis of this directory of code files. Generate an in-depth technical walkthrough that explains exactly what this component does, its internal architecture, implementation details, and its relationship to the broader system. Your response should be well formatted using markdown and easily digestible by an engineer navigating the codebase.

Additional Instructions:
- Begin with a clear explanation of the component's purpose, architecture, and key responsibilities
- Include complete and detailed directory structures using code blocks with the full file tree of the directory, with each file having comments on its functionality
- Explain the key components of this service or module and how it may interact with other services or modules, specifically enumerating/outlining the different types of data or message flows between components if there are any

System Description: ${params.systemDescription}

Overall Repository File Tree:
${params.repoFileTree}

Processing Directory: ${params.directory}

Directory File Tree:
${params.dirFileTree}

Source Files (file path and content):
${fileContentsStr}
`;
}

/**
 * Generates a prompt for merging summaries
 */
export function createMergeSummariesPrompt(params: {
  systemDescription: string;
  repoFileTree: string;
  summaries: Record<string, string>;
  example?: string;
}): string {
  let summariesStr = "";
  for (const [directory, summary] of Object.entries(params.summaries)) {
    summariesStr += `Walkthrough for ${directory}:\n${summary}\n\n`;
  }

  return `
Create a comprehensive, technically detailed codebase walkthrough based on the component analyses provided. Your walkthrough should provide an in-depth understanding of the entire system's architecture, implementation details, and component interactions. Your response should be well formatted using markdown and easily digestible by an engineer navigating the codebase.

Additional Instructions:
- Begin with a thorough overview of the system's purpose, architecture, and key components
- Each summary you are provided should have its own very thorough and highly technical section with explaining the component's role in the system, its architecture, and a full file tree with comments for its files
- After listing all subcomponents, provide a detailed walkthrough of the system's operation, including explanations of data flow and inter-service interactions for main few user scenarios. 
- Then highlight the low-level details of the inter-component interactions (e.g. what messages service A sends to service B and what the message triggers). You should explain the specific types of data or messages exchanged between specific services (i.e. literally explain which services send which messages to which other services).
- Try to keep you final merged summary under 5000 words. Closely follow the example summary provided for an example on how to write your overview.

System Description: ${params.systemDescription}

Overall Repository File Tree:
${params.repoFileTree}

Walkthroughs for each major module/directory:
${summariesStr}

Example summary:
${params.example}
`;
}

/**
 * Generate a summary for a specific directory
 */
export async function generateDirectorySummary(
  llmClient: LanguageModelV1,
  systemDescription: string,
  directory: string,
  dirFileTree: string,
  fileContents: Record<string, string>,
  repoFileTree: string,
  abortSignal?: AbortSignal
): Promise<string> {
  const prompt = createDirectorySummaryPrompt({
    systemDescription,
    repoFileTree,
    directory,
    dirFileTree,
    fileContents,
  });

  try {
    const { text } = await generateText({
      model: llmClient,
      system: SUMMARIZATION_SYSTEM_PROMPT,
      prompt,
      abortSignal,
    });

    return text;
  } catch (error) {
    logger.error(`Error generating directory summary: ${error}`);
    return `Error generating summary for ${directory}: ${error}`;
  }
}

/**
 * Merge all directory summaries into a final document
 */
export async function mergeAllSummaries(
  llmClient: LanguageModelV1,
  systemDescription: string,
  summaries: Record<string, string>,
  repoFileTree: string,
  abortSignal?: AbortSignal
): Promise<string> {
  const example = MERGE_SUMMARIES_EXAMPLE;
  const prompt = createMergeSummariesPrompt({
    systemDescription,
    repoFileTree,
    summaries,
    example,
  });

  try {
    const { text } = await generateText({
      model: llmClient,
      system: SUMMARIZATION_SYSTEM_PROMPT,
      prompt,
      abortSignal,
    });

    return text;
  } catch (error) {
    logger.error(`Error merging summaries: ${error}`);
    return `Error generating final document: ${error}`;
  }
}
