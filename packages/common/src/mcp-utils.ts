import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { logger } from "./logger";

/**
 * Zod schema for the inner text content
 */
export const TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

/**
 * Zod schema for the content array
 */
export const ContentArraySchema = z.array(TextContentSchema);

/**
 * Zod schema for the outer response
 */
export const ToolResponseSchema = z.object({
  content: ContentArraySchema,
  isError: z.boolean().optional(),
});

/**
 * Interface for unstructured response with potential content array
 */
interface UnstructuredResponse {
  content?: Array<{ text?: string }>;
  isError?: boolean;
}

/**
 * Type for the normalized tool response
 */
type NormalizedToolResponse = z.infer<typeof ToolResponseSchema>;

/**
 * Parse the tool call response, handling potential double nesting and error cases
 * @param response The raw response from callTool
 * @returns The properly parsed response object
 */
export function parseMCPToolCallResponse(response: unknown): NormalizedToolResponse {
  try {
    // Check if the response is an error
    const typedResponse = response as UnstructuredResponse;
    if (typedResponse?.isError === true && typedResponse?.content?.[0]?.text) {
      return {
        content: [{ type: "text", text: typedResponse.content[0].text || "" }],
        isError: true,
      };
    }

    // First, try parsing as the expected structure
    const parsedResponse = ToolResponseSchema.safeParse(response);

    if (parsedResponse.success) {
      // Check for nested JSON in the text content
      if (parsedResponse.data.content.length > 0 && parsedResponse.data.content[0]) {
        const text = parsedResponse.data.content[0].text;

        try {
          // Try to parse the inner JSON
          const parsedText = JSON.parse(text) as unknown;

          // Check if the parsed text is another tool response
          const nestedResponse = TextContentSchema.safeParse(parsedText);
          if (nestedResponse.success) {
            // Parse the entire array of text content and replace the content of "content"
            // using TextContentSchema
            const parsedTextArray = parsedResponse.data.content.map((text) => ({
              type: "text" as const,
              text: TextContentSchema.parse(text).text,
            }));
            return {
              content: parsedTextArray,
              isError: parsedResponse.data.isError,
            };
          }

          // Check if the parsed text is a content array
          const nestedContentArray = ContentArraySchema.safeParse(parsedText);
          if (nestedContentArray.success) {
            return {
              content: nestedContentArray.data,
              isError: parsedResponse.data.isError,
            };
          }

          // Not a nested response format, return the original
          return parsedResponse.data;
        } catch {
          // If parsing fails, just return the original parsed response
          return parsedResponse.data;
        }
      }

      return parsedResponse.data;
    }

    // Check for unstructured response with potential nested JSON
    if (typedResponse?.content?.[0]?.text) {
      try {
        const innerJsonText = typedResponse.content[0].text;
        const innerJson = JSON.parse(innerJsonText) as unknown;

        // Try parsing inner JSON as a tool response
        const nestedResponse = ToolResponseSchema.safeParse(innerJson);
        if (nestedResponse.success) {
          return nestedResponse.data;
        }

        // Try parsing inner JSON as a content array
        const nestedContentArray = ContentArraySchema.safeParse(innerJson);
        if (nestedContentArray.success) {
          return {
            content: nestedContentArray.data,
            isError: typedResponse.isError,
          };
        }

        // Create a normalized response with the inner JSON content
        const normalizedContent: TextContent[] = [];

        if (Array.isArray(innerJson)) {
          // Extract text from array items if they match expected format
          for (const item of innerJson) {
            if (
              item &&
              typeof item === "object" &&
              "type" in item &&
              typeof item.type === "string" &&
              item.type === "text" &&
              "text" in item &&
              typeof item.text === "string"
            ) {
              normalizedContent.push({ type: "text", text: item.text as string });
            }
          }

          if (normalizedContent.length > 0) {
            return {
              content: normalizedContent,
              isError: typedResponse.isError,
            };
          }
        }

        // If inner JSON structure doesn't match expected formats,
        // create a normalized response with the stringified inner JSON
        return {
          content: [{ type: "text", text: JSON.stringify(innerJson) }],
          isError: typedResponse.isError,
        };
      } catch {
        // If parsing fails, create a normalized response with the original text
        return {
          content: [
            {
              type: "text",
              text: typedResponse.content[0].text || "",
            },
          ],
          isError: typedResponse.isError,
        };
      }
    }

    // If all else fails, create a normalized response with the stringified input
    logger.warn("Could not parse tool call response with schema, creating normalized response");
    return {
      content: [
        {
          type: "text",
          text: typeof response === "string" ? response : JSON.stringify(response),
        },
      ],
      isError: false,
    };
  } catch (error) {
    logger.error(`Error parsing tool call response: ${String(error)}`);
    return {
      content: [
        {
          type: "text",
          text: String(error),
        },
      ],
      isError: true,
    };
  }
}
