/**
 * Index file for electron handlers
 * Exports all handler setup and cleanup functions
 */

export { cleanupAgentHandlers, setupAgentHandlers } from "./agent-handlers.js";
export { cleanupCodebaseHandlers, setupCodebaseHandlers } from "./codebase-handlers.js";
export { cleanupConfigHandlers, setupConfigHandlers } from "./config-handlers.js";
export { cleanupDbHandlers, setupDbHandlers } from "./db-handlers.js";
export {
  cleanupObservabilityHandlers,
  setupObservabilityHandlers,
} from "./observability-handlers.js";
export { cleanupSentryHandlers, setupSentryHandlers } from "./sentry-handlers.js";
