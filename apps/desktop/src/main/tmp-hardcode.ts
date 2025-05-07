import { IntegrationType } from "@renderer/types";

/**
 * Temporary hardcoded values for agent and observability configuration
 * TODO: Implement proper handling for these and expose them in the UI
 */
export const DEFAULT_INTEGRATION_TYPE = IntegrationType.DATADOG;
export const DEFAULT_OBSERVABILITY_FEATURES = ["logs"];
export const DEFAULT_START_DATE = new Date("2025-04-16T21:00:00Z");
export const DEFAULT_END_DATE = new Date("2025-04-16T23:59:59Z");
