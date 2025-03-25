import {
  AnthropicModel,
  getModelWrapper,
  logger,
  OpenAIModel,
  ripgrepSearch,
} from "@triage/common";
import { generateText } from "ai";
import {
  CodeSearchInput,
  codeSearchInputToolSchema,
  TaskComplete,
  taskCompleteToolSchema,
} from "../types";
import { validateToolCalls } from "./utils";

const RIPGREP_GUIDE = `
// Example 1: Search for the literal string "fast" in the "README.md" file in the current directory.
CodeSearchInput({
  directory: ".",
  content_regex: "fast",
  file_path_regex: "README.md"
});

// Example 2: Search for Rust function definitions ("fn write(") within Rust files in the "./src" directory.
// Note: The parenthesis is escaped.
CodeSearchInput({
  directory: "./src",
  content_regex: "fn write\\(",
  file_path_regex: "*.rs"
});

// Example 3: Search for JavaScript "console.log" statements in all ".js" files within the "./lib" directory.
CodeSearchInput({
  directory: "./lib",
  content_regex: "console\\.log",
  file_path_regex: "*.js"
});

// Example 4: Search for "TODO" comments in Python files within the "./project" directory.
CodeSearchInput({
  directory: "./project",
  content_regex: "TODO",
  file_path_regex: "*.py"
});

// Example 5: Leave both regexes as empty strings to disable regex filtering.
// This means all file contents and file paths will be considered during the search.
CodeSearchInput({
  directory: "./all_files",
  content_regex: "",
  file_path_regex: ""
});
`;

export type CodeSearchResponse = CodeSearchInput | TaskComplete;

class CodeSearch {
  private llm: OpenAIModel | AnthropicModel;

  constructor(llm: OpenAIModel | AnthropicModel) {
    this.llm = llm;
  }

  async invoke(params: {
    issue: string;
    request: string;
    chatHistory: string[];
    repoPath: string;
    codebaseOverview: string;
    fileTree: string;
    visitedDirectories: string[];
  }): Promise<CodeSearchResponse> {
    const prompt = `
You are an expert AI assistant that helps engineers debug production issues by finding sections of code relevant to the problem. Your task is to locate files based on the request.

Given a request for the type of code needed for the investigation, paths to all directories/files within the codebase, previously fetched context during your exploration, your task is to fetch files relevant to the request. You will do so by outputting your intermediate reasoning then outputting EITHER a CodeSearchInput to read from another directory OR a TaskComplete to indicate that you have completed the request.

<ignore this>
When specifying regex patterns:
- Use the 'contents_regex' field to provide an optional regex that matches text inside files.
- Optionally, supply a 'file_path_regex' to filter which files (by their absolute paths) should be searched.
</ignore this>
  
<ripgrep_guide>
${RIPGREP_GUIDE}
</ripgrep_guide>

Guidelines:
- Only gather as much context as the request tells you to; do not oversearch.
- When outputting a CodeSearchInput, you will be provided with all files in that directory recursively.
- Use the provided codebase overview and file tree to decide which directories to inspect.
- Construct absolute path for the directory
- Do not re-search directories that have already been visited.
- Stay focused on the areas relevant to the issue.
- DO NOT output ".*" as the contents_regex. "." is the default for matching on everything.

<current_time>
${new Date().toUTCString()}
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

<visited_directories>
${params.visitedDirectories.join("\n")}
</visited_directories>

<chat_history>
${params.chatHistory.join("\n")}
</chat_history>

<issue>
${params.issue}
</issue>

<search_request>
${params.request ?? "No search request provided"}
</search_request>
`;

    try {
      const { toolCalls } = await generateText({
        model: getModelWrapper(this.llm),
        prompt: prompt,
        tools: {
          codeSearchInput: codeSearchInputToolSchema,
          taskComplete: taskCompleteToolSchema,
        },
      });

      const toolCall = validateToolCalls(toolCalls);

      if (toolCall.toolName === "codeSearchInput") {
        return {
          type: "codeSearchInput",
          ...toolCall.args,
        };
      } else {
        return {
          type: "taskComplete",
          ...toolCall.args,
        };
      }
    } catch (error) {
      logger.error("Error generating span search query:", error);
      return {
        type: "codeSearchInput",
        directoryPath: params.repoPath,
        reasoning: "Failed to generate query with LLM. Using fallback query.",
      };
    }
  }
}

export class CodeSearchAgent {
  private llm: OpenAIModel | AnthropicModel;
  private codeSearch: CodeSearch;

  constructor(llm: OpenAIModel | AnthropicModel) {
    this.llm = llm;
    this.codeSearch = new CodeSearch(llm);
  }

  async invoke(params: {
    issue: string;
    request: string;
    chatHistory: string[];
    repoPath: string;
    codebaseOverview: string;
    fileTree: string;
    visitedDirectories: string[];
  }): Promise<{
    chatHistory: string[];
  }> {
    try {
      const response = await this.codeSearch.invoke({
        issue: params.issue,
        request: params.request,
        chatHistory: params.chatHistory,
        repoPath: params.repoPath,
        codebaseOverview: params.codebaseOverview,
        fileTree: params.fileTree,
        visitedDirectories: params.visitedDirectories,
      });

      logger.info(`CodeSearch reasoning: ${response.reasoning}`);

      if (response.type === "codeSearchInput") {
        logger.info(`CodeSearchInput: ${JSON.stringify(response)}`);

        const codeContext = ripgrepSearch({
          directory: response.directoryPath,
        });

        logger.info(`Code search results: ${codeContext}`);

        return {
          chatHistory: [
            ...params.chatHistory,
            `Reasoning: ${response.reasoning}`,
            `Directory: ${response.directoryPath}. ` + `Code search results:\n${codeContext}`,
          ],
        };
      } else if (response.type === "taskComplete") {
        logger.info(`CodeSearch TaskComplete`);
        return {
          chatHistory: [
            ...params.chatHistory,
            `Reasoning: ${response.reasoning}`,
            "-- Code Search Task Complete --",
          ],
        };
      } else {
        throw new Error(`Unknown output type: ${response}`);
      }
    } catch (error) {
      logger.error(`Error in CodeSearchAgent.invoke: ${error}`);
      throw error;
    }
  }
}
