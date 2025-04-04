import {
  commaStringToList,
  extractXmlContent,
  formatCodeMap,
  getSourceCodeFromPaths,
  initMCPClient,
  logger,
  parseToolCallResultToString,
} from "@triage/common";
import { Log } from "@triage/observability";
import { LogSearchInput } from "../../types";
import { formatLogResults } from "../utils";
const DEFAULT_TOOL_CALL_TIMEOUT = 1200 * 1000; // 20 minutes

export interface ClaudeCodeSearchResponse {
  newFilesRead: Map<string, string>;
  summary: string;
}

function createMcpPrompt(params: {
  query: string;
  codeRequest: string; // TODO: add back in if needed
  chatHistory: string[]; // TODO: add back in if needed
  repoPath: string;
  codebaseOverview: string;
  filesRead: Map<string, string>;
  logContext: Map<LogSearchInput, Log[] | string>;
  fileTree: string;
}): string {
  return `
You are an expert AI assistant that helps engineers debug production issues by navigating the codebase.

Given an user query (about a potential issue/event), previously gathered code and logs, a codebase overview, the files you've previously read, your taks is to figure out the root cause of the issue and propose a fix. Propose an exact code change and do not stop exploring until you are fully sure of your exact code changes. Again you must propose exact fixes in the code

At the end of your search, list all _new_ files you opened/read (not including the ones already in the <previous_files_read> tag) in a comma-separated list wrapped in <new_files_read> tag. This means any file that was opened and read from the codebase during the process of exploring code. Then output your fully-detailed root cause analysis and your exact code-level changes (with code in the answer) in the <summary> tags.

<query>
${params.query}
</query>

<previous_files_read>
${formatCodeMap(params.filesRead)}
</previous_files_read>

<previous_read_logs>
${formatLogResults(params.logContext)}
</previous_read_logs>

<repo_path>
${params.repoPath}
</repo_path>

<codebase_overview>
${params.codebaseOverview}
</codebase_overview>

<file_tree>
${params.fileTree}
</file_tree>
    `;
}

export class CodeSearch {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  async invoke(params: {
    query: string;
    repoPath: string;
    codebaseOverview: string;
    fileTree: string;
    chatHistory: string[];
    codeRequest: string;
    filesRead: Map<string, string>;
    logContext: Map<LogSearchInput, Log[] | string>;
  }): Promise<ClaudeCodeSearchResponse> {
    logger.info(`Searching codebase for query: ${params.query}`);
    const mcpClient = await initMCPClient(this.repoPath);
    const mcpPrompt = createMcpPrompt(params);

    logger.info(`MCP prompt:\n${mcpPrompt}`);
    const mcpResponse = await mcpClient.callTool({
      name: "dispatch_agent",
      arguments: {
        prompt: mcpPrompt,
      },
      options: {
        timeout: DEFAULT_TOOL_CALL_TIMEOUT,
      },
    });

    const parsedMcpResponse = parseToolCallResultToString(mcpResponse);

    logger.info(`MCP response: ${parsedMcpResponse}`);

    const summary = extractXmlContent(parsedMcpResponse, "summary") ?? "No summary found.";
    const newFilesReadContent = extractXmlContent(parsedMcpResponse, "new_files_read");
    const newFilesReadList = newFilesReadContent ? commaStringToList(newFilesReadContent) : [];
    const newFilesReadMap = getSourceCodeFromPaths(newFilesReadList);

    return {
      summary,
      newFilesRead: newFilesReadMap,
    };
  }
}
