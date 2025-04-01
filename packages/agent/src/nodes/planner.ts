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
  query: string;
  repoPath: string;
  codebaseOverview: string;
  fileTree: string;
  logLabelsMap: string;
  spanLabelsMap: string;
}) => {
  const currentTime = new Date().toISOString();

  return `
You are an expert AI assistant that assists engineers debugging production issues. You specifically take a query (question or issue description from an oncall engineer) and convert that into requests for code, logs, and spans you think will reveal the answer to the question or root cause of the issue.

Given the query, an overview of the codebase, the codebase file tree, and potential log labels, your task is output requests for what code, logs, and spans you think will reveal the answer to the query. Output a \`CodeRequest\` describing what parts you system/codebase you need code from, a \`LogRequest\` describing what logs you need (e.g. from which services, relating to what, around what time), and a \`SpanRequest\` describing what spans you need (e.g. from which services, relating to what, around what time).

Guidelines:
- Be very concise and direct in your requests (see examples below)
- Don't just narrow in directly in on just the code or logs directly related to or displaying the issue, but consider other services you think are most likely to also be involved.
- Do not specify specific files or lines of code, keep requests higher level.
- Especially in microservices, the root cause may not be in the service that is failing, but in another service that is interacting with it. Consider other services.

Examples:
- CodeRequest description: "Output code from the recommendations and posts services."
- LogRequest description: "Output logs from the recommendations and posts services around the time of the issue (+/- 15m)."
- SpanRequest description: "Output spans from the recommendations and posts services around the time of the issue (+/- 15m)."

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

<log_labels>
${params.logLabelsMap}
</log_labels>

<span_labels>
${params.spanLabelsMap}
</span_labels>

<query>
${params.query}
</query>

Return your response in the following format, using XML tags:
<response>
<code_request>
Your CodeRequest description here
</code_request>
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
    query: string;
    repoPath: string;
    codebaseOverview: string;
    fileTree: string;
    logLabelsMap: string;
    spanLabelsMap: string;
  }): Promise<PlannerResponse> {
    logger.info(`Planning step with query: ${params.query}`);

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
