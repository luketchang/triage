import {
  commaStringToList,
  extractXmlContent,
  formatCodeMap,
  getSourceCodeFromPaths,
  initMCPClient,
  logger,
  parseToolCallResultToString,
} from "@triage/common";
import { formatChatHistory } from "../utils";

const DEFAULT_TOOL_CALL_TIMEOUT = 1200 * 1000; // 20 minutes

export interface ClaudeCodeSearchResponse {
  newFilesRead: Map<string, string>;
  summary: string;
}

function createMcpPrompt(params: {
  query: string;
  codeRequest: string;
  chatHistory: string[];
  repoPath: string;
  codebaseOverview: string;
  filesRead: Map<string, string>;
  fileTree: string;
}): string {
  return `
You are an expert AI assistant that helps engineers debug production issues by finding sections of code relevant to the problem. Your task is to explore/surface files based on the request.

Given an user query (about a potential issue/event), previously gathered context, a codebase overview, the files you've previously read, and a code request (directive for what code to explore), your task is to explore the codebase and return a summary of your findings.

As you explore the codebase, reflect on 5-7 different possible sources of the issue/event and use that to guide your search along with the code request.

At the end of your search, list all _new_ files you opened/read (not including the ones already in the <previous_files_read> tag) in a comma-separated list wrapped in <new_files_read> tag. This means any file that was opened and read from the codebase during the process of exploring code. Then output a summary of your findings in the <summary> tags.

Your summary should be a list of observations about the codebase that are relevant to the user query. The response should NOT be speculative about any root causes or further issues—it should objectively summarize what the code shows.

<query>
${params.query}
</query>

<code_request>
${params.codeRequest}
</code_request>

<chat_history>
${formatChatHistory(params.chatHistory)}
</chat_history>

<previous_files_read>
${formatCodeMap(params.filesRead)}
</previous_files_read>

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
  }): Promise<ClaudeCodeSearchResponse> {
    logger.info(`Searching codebase for query: ${params.query}`);
    const mcpClient = await initMCPClient(this.repoPath);
    const mcpPrompt = createMcpPrompt(params);

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
