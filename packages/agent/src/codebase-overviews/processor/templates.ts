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
Your task is to analyze this directory of code files and generate a narrative overview that explains what this component does, its architecture, and how it fits into the broader system. Focus on creating a readable, flowing document rather than a structured reference.

Additional Instructions:
- Explain the component's purpose, architecture, and key responsibilities in a narrative style
- Show directory structures using code blocks, but integrate explanations within and around them
- For each significant module or file, explain not just what it does but why it exists and how it relates to other components
- Highlight important design patterns, data flows, and architectural decisions
- If the directory contains a service, explain its event interactions with other services
- Use markdown formatting with headers, lists, and code blocks to organize the content
- Avoid excessive listing of file contents - focus on the most important components and their relationships

System Description: ${params.systemDescription}

Overall Repository File Tree:
----------------------------------------
${params.repoFileTree}
----------------------------------------

Processing Directory: ${params.directory}
Directory File List:
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
}): string {
  let summariesStr = "";
  for (const [directory, summary] of Object.entries(params.summaries)) {
    summariesStr += `Walkthrough for ${directory}:\n${summary}\n\n`;
  }

  return `
Synthesize a comprehensive codebase walkthrough based on the individual component summaries provided. Create a narrative document that explains the system architecture, components, and how they interact with each other.

Additional Instructions:
- Begin with a broad overview of the entire system's purpose and architecture
- Create a flowing, narrative explanation of how components work together
- Include a high-level visual representation of the directory structure using code blocks
- Focus heavily on explaining the event flows and data interactions between services
- Explain the key design patterns and architectural decisions behind the system
- For microservices, clearly explain how they communicate with each other
- Include a detailed section on the event flow between components with examples
- Use a hierarchical structure with main sections and relevant subsections
- Use markdown for formatting, with headers, lists, and code blocks

System Description: ${params.systemDescription}

Overall Repository File Tree:
${params.repoFileTree}

Walkthroughs for each major module/directory:
${summariesStr}

Be sure to conclude with a section that ties everything together, explaining how all components interact in typical user flows or system operations.
`;
}

/**
 * Generates a prompt for top-level module identification
 */
export function createTopLevelIdentificationPrompt(params: { repoFileTree: string }): string {
  return `
You are given the file tree of a repository. Your task is to identify upper-level directories that represent separate services or top-level modules. These directories are independent services/modules that can (or should) be summarized individually.

Return a JSON array of directory paths (relative to the repository root) that should be treated as separate services or packages. Prioritize recall over precision, be generous about including directories as services. But note that you must choose directories not actual files.

Repository File Tree:
${params.repoFileTree}
`;
}
