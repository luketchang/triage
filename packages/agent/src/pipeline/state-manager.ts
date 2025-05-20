import { CoreMessage } from "ai";

import { ChatMessage } from "../types/message";
import {
  formatAgentSteps,
  formatCatToolCallsWithResults,
  formatLogSearchToolCallsWithResults,
} from "../utils";

import {
  AgentStep,
  CatToolCallWithResult,
  GrepToolCallWithResult,
  LogSearchToolCallWithResult,
  StepsType,
  StreamUpdateFn,
} from "./state";

/**
 * Manages the pipeline state for the agent system.
 * 
 * Responsible for:
 * - Tracking and updating the current pipeline execution state
 * - Managing streaming and non-streaming updates
 * - Providing formatted access to chat history, tool calls, and reasoning steps
 * - Facilitating communication between pipeline components
 */
export class PipelineStateManager {
  /** Function called when pipeline state changes, enabling real-time updates */
  private onUpdate: StreamUpdateFn;
  /** Persistent chat history containing all user and assistant messages */
  private chatHistory: ChatMessage[] = [];
  /** In-progress agent steps for the current execution cycle, not yet committed to chat history */
  private currSteps: AgentStep[] = [];
  /** Final response text generated for the current execution cycle */
  private answer?: string;

  /**
   * Initializes a new pipeline state manager
   * 
   * @param onUpdate - Function to call when state changes occur, enabling UI updates
   * @param chatHistory - Existing chat history to initialize with (empty array if new conversation)
   */
  constructor(onUpdate: StreamUpdateFn, chatHistory: ChatMessage[]) {
    this.onUpdate = onUpdate;
    this.chatHistory = chatHistory;
  }

  /**
   * Processes a streaming chunk update from a pipeline component
   * 
   * Used for real-time updates during ongoing operations like reasoning,
   * log searching, or code searching. Triggers the onUpdate callback
   * with appropriate metadata.
   * 
   * @param type - The component type generating the update
   * @param id - Unique identifier for tracking the specific operation
   * @param chunk - Content fragment to be streamed to the UI
   */
  addStreamingUpdate(
    type: "reasoning" | "logSearch" | "codeSearch",
    id: string,
    chunk: string
  ): void {
    this.onUpdate({
      id,
      type: `${type}-chunk`,
      chunk,
      timestamp: new Date(),
    });
  }

  /**
   * Records a completed pipeline step and triggers appropriate UI updates
   * 
   * Stores the step in the current execution cycle and dispatches
   * formatted updates based on the step type. Handles special cases
   * for different step types (reasoning, logSearch, codeSearch).
   * 
   * @param step - The completed agent step with its associated data
   */
  addUpdate(step: AgentStep): void {
    this.currSteps.push(step);

    // NOTE: reasoner does not output end tool calls, just subagent calls
    if (step.type === "reasoning") {
      return;
    }

    if (step.type === "logSearch") {
      this.onUpdate({
        ...step,
        type: `${step.type}-tools`,
        toolCalls: step.data,
      });
    } else if (step.type === "codeSearch") {
      this.onUpdate({
        ...step,
        type: `${step.type}-tools`,
        toolCalls: step.data,
      });
    } else {
      this.onUpdate(step);
    }
  }

  /**
   * Transforms internal chat history into the format required by the AI messaging system
   * 
   * Processes both user and assistant messages, formatting assistant messages
   * to include gathered context, responses, and any errors in a structured format.
   * 
   * @returns Formatted messages ready for consumption by the AI system
   */
  chatHistoryAsCoreMessages(): CoreMessage[] {
    const coreMessages: CoreMessage[] = [];
    for (const message of this.chatHistory) {
      if (message.role === "user") {
        coreMessages.push({
          role: "user",
          content: message.content,
        });
      } else {
        // For assistant messages, create a content string that includes gathered context and response
        let content = "";

        // Add gathered context if there are steps
        if (message.steps && message.steps.length > 0) {
          content += `Gathered Context:\n${formatAgentSteps(message.steps)}`;
        }

        // Add response if it exists
        if (message.response) {
          // If we already have content, add a newline before the response
          if (content) {
            content += "\n\n";
          }
          content += `Response: ${message.response}`;
        }

        // Add error if it exists
        if (message.error) {
          // If we already have content, add a newline before the error
          if (content) {
            content += "\n\n";
          }
          content += `Error: ${message.error}`;
        }

        // Only push if there's content to push
        if (content) {
          coreMessages.push({
            role: "assistant",
            content,
          });
        }
      }
    }
    return coreMessages;
  }

  /**
   * Constructs the complete message sequence for the reasoning component
   * 
   * Combines system prompt, chat history, and current context (logs and code)
   * into a structured format that provides the reasoner with all necessary
   * information to generate a response.
   * 
   * @param systemPrompt - Instructions that guide the reasoner's behavior
   * @returns Complete message sequence for the reasoning component
   */
  getReasonerMessages(systemPrompt: string): CoreMessage[] {
    const chatHistory = this.chatHistoryAsCoreMessages();
    console.info("Chat history reasoner: ", JSON.stringify(chatHistory));

    const logContextToolCalls = this.getLogSearchToolCallsWithResults(StepsType.CURRENT);
    const codeContextToolCalls = this.getCatToolCallsWithResults(StepsType.CURRENT);
    return [
      {
        role: "system",
        content: systemPrompt,
      },
      ...chatHistory,
      {
        role: "assistant",
        content: `<log_context>\n${formatLogSearchToolCallsWithResults(logContextToolCalls)}\n</log_context>\n\n<code_context>\n${formatCatToolCallsWithResults(codeContextToolCalls)}\n</code_context>`,
      },
    ];
  }

  /**
   * Retrieves agent steps based on the specified scope
   * 
   * Provides flexible access to pipeline steps with three scopes:
   * - CURRENT: Only steps from the current execution cycle
   * - PREVIOUS: Only steps from previous cycles (from chat history)
   * - BOTH: Combined steps from both current and previous cycles
   * 
   * @param type - Scope specification determining which steps to retrieve
   * @returns Filtered array of agent steps matching the requested scope
   */
  getSteps(type: StepsType): AgentStep[] {
    switch (type) {
      case StepsType.CURRENT:
        return this.currSteps;
      case StepsType.PREVIOUS:
        return this.chatHistory
          .filter((message) => message.role === "assistant")
          .flatMap((message) => message.steps || [])
          .filter((step) => step !== undefined);
      case StepsType.BOTH:
        return [
          ...this.chatHistory
            .filter((message) => message.role === "assistant")
            .flatMap((message) => message.steps || [])
            .filter((step) => step !== undefined),
          ...this.currSteps,
        ];
    }
  }

  /**
   * Extracts log search operations and their results from agent steps
   * 
   * Filters the specified steps to find log search operations,
   * then extracts their associated data for use in context building
   * or result presentation.
   * 
   * @param type - Scope of steps to search within (CURRENT, PREVIOUS, or BOTH)
   * @returns Collection of log search operations with their results
   */
  getLogSearchToolCallsWithResults(type: StepsType): LogSearchToolCallWithResult[] {
    return this.getSteps(type)
      .filter((step) => step.type === "logSearch")
      .flatMap((step) => step.data);
  }

  /**
   * Extracts file content retrieval operations and their results
   * 
   * Filters code search steps to find 'cat' operations (file content retrievals),
   * then extracts their associated data for use in context building
   * or result presentation.
   * 
   * @param type - Scope of steps to search within (CURRENT, PREVIOUS, or BOTH)
   * @returns Collection of file content operations with their results
   */
  getCatToolCallsWithResults(type: StepsType): CatToolCallWithResult[] {
    return this.getSteps(type)
      .filter((step) => step.type === "codeSearch")
      .flatMap((step) => step.data)
      .filter((data) => data.type === "cat");
  }

  /**
   * Extracts code search operations and their results
   * 
   * Filters code search steps to find 'grep' operations (pattern searches),
   * then extracts their associated data for use in context building
   * or result presentation.
   * 
   * @param type - Scope of steps to search within (CURRENT, PREVIOUS, or BOTH)
   * @returns Collection of code search operations with their results
   */
  getGrepToolCallsWithResults(type: StepsType): GrepToolCallWithResult[] {
    return this.getSteps(type)
      .filter((step) => step.type === "codeSearch")
      .flatMap((step) => step.data)
      .filter((data) => data.type === "grep");
  }

  /**
   * Provides access to the complete conversation history
   * 
   * @returns The full sequence of user and assistant messages
   */
  getChatHistory(): ChatMessage[] {
    return this.chatHistory;
  }

  /**
   * Stores the final response text for the current execution cycle
   * 
   * Called when the pipeline has completed processing and generated
   * a final response to the user's query.
   * 
   * @param answer - The final response text to store
   */
  setAnswer(answer: string): void {
    this.answer = answer;
  }

  /**
   * Retrieves the current final response text, if available
   * 
   * @returns The stored response text, or undefined if not yet set
   */
  getAnswer(): string | undefined {
    return this.answer;
  }
}
