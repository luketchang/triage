import { z } from "zod";

import { DelegatingConfigStore } from "./DelegatingConfigStore";

/**
 * Marks a Zod schema as containing a secret value
 */
export function configSecret<T extends z.ZodType>(schema: T): T {
  return schema.describe("secret");
}

/**
 * Interface for a config store that can store and retrieve config values for a
 * specific schema
 */
export interface ConfigStore<T> {
  /**
   * Get all configuration values
   * @param schema (Optional) A sub-schema to get values for
   */
  getValues(): Promise<T>;
  getValues<S>(schema: z.ZodType<S>): Promise<S>;

  /**
   * Update multiple configuration values at once with validation
   * @param values The values to update
   * @param schema (Optional) A sub-schema to validate against
   */
  setValues(values: Partial<T>): Promise<void>;
  setValues<S>(values: Partial<S>, schema: z.ZodType<S>): Promise<void>;
}

export { DelegatingConfigStore };
