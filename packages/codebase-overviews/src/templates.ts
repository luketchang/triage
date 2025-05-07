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
- Explain the key components of this service or module and how it may interact with other services or modules

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
- After listing all subcomponents, provide a detailed walkthrough of the system's operation, including detailed explanations of data flow and service interactions for key user scenarios. This section should highlight how all the components work together and the low-level details of the inter-component interactions.
- Focus on both the individual services in detail and the fine details of how the various components interact with each other
- Include several examples of the overall system flow through various scenarios to illustrate

System Description: ${params.systemDescription}

Overall Repository File Tree:
${params.repoFileTree}

Walkthroughs for each major module/directory:
${summariesStr}

Conclude with a section that provides an end-to-end technical walkthrough of the system's operation, including detailed explanations of data flow and service interactions for key user scenarios.
`;
}

/**
 * Generates a prompt for top-level module identification
 */
export function createTopLevelIdentificationPrompt(params: { repoFileTree: string }): string {
  return `
You are given the file tree of a repository. Your task is to identify upper-level directories that represent separate services, components, or top-level modules that should be analyzed individually in depth.

Look for directories that represent:
- Microservices
- API services
- Frontend applications
- Backend services 
- Shared libraries or utilities
- Infrastructure configurations
- Domain-specific modules
- Major system components

These directories are logically independent components that require in-depth technical analysis individually. Be thorough and include all potentially significant directories.

Return a JSON array of directory paths (relative to the repository root) that should be treated as separate services or modules for detailed analysis. Prioritize recall over precision - be inclusive about which directories might contain important code. Note that you must choose directories not actual files.

Repository File Tree:
${params.repoFileTree}
`;
}
