import { AssistantMessage } from "../types/index.js";

/**
 * MessageUpdater
 *
 * A simple utility for updating Assistant messages and notifying listeners
 * when updates occur. This replaces the more complex CellUpdateManager.
 */
export class MessageUpdater {
  private message: AssistantMessage;
  private onUpdate: (message: AssistantMessage) => void;

  /**
   * Constructor
   *
   * @param initialMessage - The initial message state
   * @param onUpdate - Callback to be called after each update
   */
  constructor(initialMessage: AssistantMessage, onUpdate: (message: AssistantMessage) => void) {
    this.message = initialMessage;
    this.onUpdate = onUpdate;
  }

  /**
   * Get the current message state
   *
   * @returns The current message
   */
  getMessage(): AssistantMessage {
    return this.message;
  }

  /**
   * Update the message
   *
   * @param updateFn - Function that describes how to update the message
   */
  update(updateFn: (message: AssistantMessage) => AssistantMessage): void {
    try {
      // Apply the update function
      this.message = updateFn(this.message);

      // Notify listeners of the update
      this.onUpdate(this.message);
    } catch (error) {
      console.error("Error updating message:", error);
    }
  }
}
