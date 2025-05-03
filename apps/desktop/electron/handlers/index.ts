/**
 * Index file for electron handlers
 * Exports all handler setup and cleanup functions
 */

export { cleanupAgentHandlers, setupAgentHandlers } from "./agent-handlers.js";
export { cleanupChatHandlers, setupChatHandlers } from "./chat-handlers.js";
export {
  cleanupObservabilityHandlers,
  setupObservabilityHandlers,
} from "./observability-handlers.js";
