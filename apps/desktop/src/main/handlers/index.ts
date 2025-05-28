/**
 * Index file for electron handlers
 * Exports all handler setup and cleanup functions
 */

export { cleanupAgentHandlers, setupAgentHandlers } from "./agent-handlers.js";
export { cleanupCodebaseHandlers, setupCodebaseHandlers } from "./codebase-handlers.js";
export { cleanupConfigHandlers, setupConfigHandlers } from "./config-handlers.js";
export {
  cleanupDataIntegrationHandlers,
  setupDataIntegrationHandlers,
} from "./data-integration-handlers.js";
export { cleanupDbHandlers, setupDbHandlers } from "./db-handlers.js";
