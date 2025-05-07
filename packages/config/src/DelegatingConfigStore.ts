import { z } from "zod";

import { ConfigStore } from "./index";

/**
 * Stores config values by delegating operations to a parent config store.
 * This is useful for creating specialized config views that use a specific schema
 * while delegating the actual storage operations to the parent store.
 */
export class DelegatingConfigStore<T> implements ConfigStore<T> {
  /**
   * Create a new config view
   * @param parentStore The config provider to use
   * @param schema The schema for this config view
   */
  constructor(
    protected parentStore: ConfigStore<T>,
    protected schema: z.ZodTypeAny
  ) {}

  /**
   * Get all config values for this schema
   */
  async getValues<S = T>(schema?: z.ZodType<S>): Promise<S extends T ? S : T> {
    return this.parentStore.getValues(schema ?? this.schema) as Promise<S extends T ? S : T>;
  }

  /**
   * Update config values for this schema
   * @param partial Partial config values to update
   */
  async setValues<S = T>(partial: Partial<S>, schema?: z.ZodType<S>): Promise<void> {
    return this.parentStore.setValues(partial, schema ?? this.schema);
  }
}
