import {
  AnthropicModel,
  extractXmlContent,
  getModelWrapper,
  logger,
  OpenAIModel,
} from "@triage/common";
import { generateText } from "ai";

export interface PlannerResponse {
  reasoning: string;
  codeRequest: string;
  spanRequest: string;
  logRequest: string;
}
const createPrompt = (params: {
  issue: string;
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  labelsMap: string;
}) => {
  const currentTime = new Date().toISOString();

  return `
You are an expert AI assistant that assists engineers debugging production issues. You specifically take a description of an issue and convert that into requests for code, logs, and spans you think will reveal the root cause of the issue.

Given the issue encountered, an overview of the codebase, the codebase file tree, and potential log labels, your task is output requests for what code and logs you think will reveal the root cause of the issue. Output a \`CodeRequest\` describing what parts you system/codebase you need code from and a \`LogRequest\` describing what logs you need (e.g. from which services, relating to what, around what time).

Guidelines:
- Be very concise and direct in your requests (see examples below)
- Don't just narrow in directly in on just the code or logs directly related to or displaying the issue, but consider other services you think are most likely to also be involved.
- Do not specify specific files or lines of code, keep requests higher level.

Examples:
- CodeRequest description: "Output code from the recommendations and posts services."
- LogRequest description: "Output logs from the recommendations and posts services around the time of the issue (+/- 15m)."

- DO NOT use XML tags
<current_time>
${currentTime}
</current_time>

<codebase_path>
${params.repoPath}
</codebase_path>

<codebase_overview>
${params.codebaseOverview}
</codebase_overview>

<file_tree>
${params.fileTree}
</file_tree>

<labels>
${params.labelsMap}
</labels>

<issue>
${params.issue}
</issue>

Return your response in the following format, using XML tags:
<response>
<code_request>
Your CodeRequest description here
</code_request>
<span_request>
Your SpanRequest description here
</span_request>
<log_request>
Your LogRequest description here
</log_request>
<reasoning>
Your reasoning here
</reasoning>
</response>
`;
};

export class Planner {
  private llm: AnthropicModel | OpenAIModel;

  constructor(llm: AnthropicModel | OpenAIModel) {
    this.llm = llm;
  }

  async invoke(params: {
    issue: string;
    repoPath: string;
    codebaseOverview: string;
    fileTree: string;
    labelsMap: string;
  }): Promise<PlannerResponse> {
    logger.info(`Planning step with issue: ${params.issue}`);

    const prompt = createPrompt(params);

    const { text } = await generateText({
      model: getModelWrapper(this.llm),
      prompt: prompt,
    });

    logger.info(`Response:\n${text}`);
    const responseXml = extractXmlContent(text, "response");

    if (!responseXml) {
      throw new Error("Failed to extract response from response");
    }

    const codeRequest = extractXmlContent(responseXml, "code_request");
    const spanRequest = extractXmlContent(responseXml, "span_request");
    const logRequest = extractXmlContent(responseXml, "log_request");
    const reasoning = extractXmlContent(responseXml, "reasoning");

    if (!codeRequest || !spanRequest || !reasoning || !logRequest) {
      throw new Error("Failed to extract code and span requests from response");
    }

    return {
      reasoning,
      codeRequest,
      spanRequest,
      logRequest,
    };
  }
}
