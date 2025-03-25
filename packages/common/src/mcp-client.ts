import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "./logger";

// Increase the timeout significantly
const DEFAULT_TOOL_CALL_TIMEOUT = 1200 * 1000; // 20 minutes

let mcpClient: Client | null = null;
let transport: StdioClientTransport | null = null;
let connected = false;

/**
 * Initializes and returns an MCP client
 * @param clientName Name for the MCP client
 * @param workingDirectory Current working directory
 * @returns The initialized MCP client
 */
export async function initMCPClient(workingDirectory: string): Promise<Client> {
  // If client already exists, return it
  if (mcpClient && connected) {
    return mcpClient;
  }

  logger.info("Initializing Claude MCP client...");

  // Configure transport with potential timeout settings
  transport = new StdioClientTransport({
    command: "claude",
    args: ["mcp", "serve"],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, value as string])
      ),
      MCP_TIMEOUT: String(DEFAULT_TOOL_CALL_TIMEOUT),
    },
    cwd: workingDirectory,
  });

  // Initialize client with explicit timeout settings
  mcpClient = new Client({
    name: "oncall",
    version: "1.0.0",
    options: {},
  });

  await mcpClient.connect(transport);
  connected = true;
  logger.info("Claude MCP client initialized successfully");

  return mcpClient;
}

/**
 * Gets the existing MCP client or creates a new one
 * @returns The MCP client
 */
export function getMCPClient(): Client | null {
  return mcpClient;
}

/**
 * Closes the MCP client connection
 */
export async function closeMCPClient(): Promise<void> {
  if (mcpClient) {
    logger.info("Closing Claude MCP client...");
    await mcpClient.close();
    mcpClient = null;
    transport = null;
    connected = false;
    logger.info("Claude MCP client closed successfully");
  }
}

interface ToolContent {
  type: string;
  text?: string;
}

interface ToolCallResult {
  content?: ToolContent[];
}

interface TextToolContent extends ToolContent {
  type: "text";
  text: string;
}

export function parseToolCallResultToString(result: unknown): string {
  const typedResult = result as ToolCallResult;
  try {
    // If content is missing, default to an empty array.
    const contents: ToolContent[] = typedResult.content ?? [];
    const texts: string[] = [];

    for (const item of contents) {
      // Only handle items of type "text"
      if (typeof item === "object" && item !== null && item.type === "text") {
        // If text is missing, default to an empty string.
        const rawText: string = item.text ?? "";
        try {
          // Parse the raw text. It could be a JSON string that represents an array.
          const parsed: unknown = JSON.parse(rawText);
          if (Array.isArray(parsed)) {
            for (const subItem of parsed) {
              // Check if subItem is a valid TextToolContent object.
              if (
                typeof subItem === "object" &&
                subItem !== null &&
                "type" in subItem &&
                (subItem as { type: unknown }).type === "text" &&
                "text" in subItem &&
                typeof (subItem as { text: unknown }).text === "string"
              ) {
                texts.push((subItem as TextToolContent).text);
              } else {
                texts.push(String(subItem));
              }
            }
          } else {
            texts.push(String(parsed));
          }
        } catch {
          // If JSON parsing fails, use the raw text.
          texts.push(rawText);
        }
      }
    }
    return texts.join("\n");
  } catch (error: unknown) {
    if (error instanceof Error) {
      return `Error parsing result: ${error.message}`;
    }
    return "Error parsing result";
  }
}
