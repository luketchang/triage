/**
 * Prompt template for generating a directory summary
 */
export const DIR_SUMMARY_TEMPLATE = `
Your task is to analyze this directory of code files and generate a narrative overview that explains what this component does, its architecture, and how it fits into the broader system. Focus on creating a readable, flowing document rather than a structured reference.

Additional Instructions:
- Explain the component's purpose, architecture, and key responsibilities in a narrative style
- Show directory structures using code blocks, but integrate explanations within and around them
- For each significant module or file, explain not just what it does but why it exists and how it relates to other components
- Highlight important design patterns, data flows, and architectural decisions
- If the directory contains a service, explain its event interactions with other services
- Use markdown formatting with headers, lists, and code blocks to organize the content
- Avoid excessive listing of file contents - focus on the most important components and their relationships

System Description: {system_description}

Overall Repository File Tree:
----------------------------------------
{repo_file_tree}
----------------------------------------

Processing Directory: {directory}
Directory File List:
{dir_file_tree}

Source Files (file path and content):
{file_contents}
`;

/**
 * Prompt template for merging summaries of all directories
 */
export const MERGE_SUMMARIES_TEMPLATE = `
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

System Description: {system_description}

Overall Repository File Tree:
{repo_file_tree}

Walkthroughs for each major module/directory:
{summaries}

Be sure to conclude with a section that ties everything together, explaining how all components interact in typical user flows or system operations.
`;

/**
 * Prompt template for identifying services from a repository file tree
 */
export const TOP_LEVEL_IDENTIFICATION_TEMPLATE = `
You are given the file tree of a repository. Your task is to identify upper-level directories that represent separate services or top-level modules. These directories are independent services/modules that can (or should) be summarized individually.

Return a JSON array of directory paths (relative to the repository root) that should be treated as separate services or packages. Prioritize recall over precision, be generous about including directories as services. But note that you must choose directories not actual files.

Repository File Tree:
{repo_file_tree}
`;
