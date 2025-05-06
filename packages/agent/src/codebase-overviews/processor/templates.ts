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
Your task is to create a comprehensive, detailed analysis of this directory of code files. Generate an in-depth technical walkthrough that explains exactly what this component does, its internal architecture, implementation details, and its relationship to the broader system.

Additional Instructions:
- Begin with a clear explanation of the component's purpose, architecture, and key responsibilities
- Include complete and detailed directory structures using code blocks
- For each significant file or module, provide in-depth analysis explaining:
  * Its purpose and implementation details
  * Key functions, classes, and data structures
  * How it interacts with other components
  * Important algorithms, patterns, or design decisions
- If the directory contains a service, thoroughly explain:
  * Its data models and schemas
  * API routes and their implementation
  * Event publishers and listeners with exact event types
  * Database interactions and data flow
  * Error handling mechanisms
- For configuration files, explain configuration options and their effects
- Include relevant code snippets to illustrate key concepts
- Explain architectural patterns and design decisions with technical justification
- Be extremely thorough, detailed, and precise in your analysis
- Use markdown formatting with headers, lists, and code blocks to organize the content
- Focus on technical depth rather than high-level summary

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
Create a comprehensive, technically detailed codebase walkthrough based on the component analyses provided. Your walkthrough should provide an in-depth understanding of the entire system's architecture, implementation details, and component interactions.

Additional Instructions:
- Begin with a thorough overview of the system's purpose, architecture, and key components
- Include detailed sections for each component with technical specifics about:
  * Implementation details
  * Data structures and models
  * Business logic
  * Communication patterns
  * Database schemas and interactions
- Include complete directory structures using code blocks
- Provide detailed explanations of:
  * Service communication mechanisms with exact event types and payloads
  * Data flow between components
  * Authentication and authorization mechanisms
  * Error handling and validation approaches
  * Environment configuration options
- For microservices, explain in precise technical detail:
  * Service boundaries and responsibilities
  * Database schemas and data models
  * API routes and endpoints
  * Event publishers and subscribers
- Show a complete event flow walkthrough with exact event types and payloads for key user scenarios
- Explain development workflow, testing approaches, and deployment processes
- Highlight important design patterns, architectural decisions, and their technical justifications
- Include relevant code snippets to illustrate key concepts
- Use markdown with headers, subheaders, code blocks, and lists for readability

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
