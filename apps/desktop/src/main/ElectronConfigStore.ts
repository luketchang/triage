import { ConfigStore } from "@triage/config";
import Store from "electron-store";
import keytar from "keytar";
import { z } from "zod";

const KEYTAR_SERVICE_NAME = "triage-desktop";
type ConfigValue = string | number | boolean | null | undefined;

/**
 * Stores config values using electron-store and keytar (for secrets)
 */
export class ElectronConfigStore<T> implements ConfigStore<T> {
  private store = new Store<Record<string, ConfigValue>>();
  private keysForSecretsCache = new Set<string>();
  private secretsCache = new Map<string, string | undefined>();

  /**
   * @param schema Zod schema to store config values for
   */
  constructor(private schema: z.ZodType<T>) {
    this.registerSchemaRecursively(schema);
  }

  private registerSchemaRecursively(schema: z.ZodTypeAny, parentKey: string = ""): void {
    if (schema instanceof z.ZodObject) {
      const shape = schema._def.shape();
      for (const [key, subSchema] of Object.entries(shape)) {
        const fullKey = parentKey ? `${parentKey}.${key}` : key;
        if (subSchema instanceof z.ZodType) {
          this.registerSchemaRecursively(subSchema, fullKey);
        }
      }
    } else if (schema instanceof z.ZodType && schema._def.description === "secret") {
      // Record which keys are secrets
      this.keysForSecretsCache.add(parentKey);
    }
  }

  /**
   * Get all configuration values for a specific schema
   * @param schema The schema to get values for
   */
  async getValues<S>(schema?: z.ZodType<S>): Promise<T | S> {
    const actualSchema = schema ?? this.schema;
    if (!(actualSchema instanceof z.ZodObject)) {
      throw new Error("Schema must be a ZodObject");
    }
    const result: Record<string, any> = {};
    const shape = actualSchema._def.shape();
    for (const [key, subSchema] of Object.entries(shape)) {
      if (subSchema instanceof z.ZodObject) {
        // Handle nested objects
        result[key] = await this.getValues(subSchema);
      } else {
        // Get the value for this key
        const value = await this.get(key);
        result[key] = value;
      }
    }
    // Validate against schema
    return actualSchema.parse(result);
  }

  private async get<V>(key: string): Promise<V | undefined> {
    // Try to get from environment variables first
    const envKey = key.replace(/\./g, "_").toUpperCase();
    if (process.env[envKey] !== undefined) {
      return process.env[envKey] as unknown as V;
    }

    // Then try to get from secure store if it's a secret
    if (this.keysForSecretsCache.has(key)) {
      if (this.secretsCache.has(key)) {
        return this.secretsCache.get(key) as unknown as V;
      }
      const val = await keytar.getPassword(KEYTAR_SERVICE_NAME, key);
      this.secretsCache.set(key, val ?? undefined);
      return val as unknown as V;
    }

    // Otherwise get from electron-store
    return this.store.get(key) as V;
  }

  /**
   * Update multiple configuration values at once with validation
   * @param schema The schema to validate against
   * @param values The values to update
   */
  async setValues<S = T>(values: Partial<S>, schema?: z.ZodType<S>): Promise<void> {
    const actualSchema = schema ?? this.schema;
    if (!(actualSchema instanceof z.ZodObject)) {
      throw new Error("Schema must be a ZodObject");
    }
    const validatedValues = actualSchema.partial().parse(values);
    for (const [key, value] of Object.entries(validatedValues)) {
      await this.set(key, value);
    }
  }
  private async set<V>(key: string, value: V): Promise<void> {
    if (this.keysForSecretsCache.has(key)) {
      await keytar.setPassword(KEYTAR_SERVICE_NAME, key, value as string);
      this.secretsCache.set(key, value as string);
    } else {
      if (value === undefined || value === null) {
        this.store.delete(key);
      } else {
        this.store.set(key, value as ConfigValue);
      }
    }
  }

  /**
   * Log all config values
   */
  async logValues(): Promise<void> {
    const config = await this.getValues();
    const logEntries: string[] = ["Configuration:"];
    for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
      if (
        this.schema instanceof z.ZodObject &&
        this.schema._def.shape()[key]?._def?.description === "secret"
      ) {
        logEntries.push(`  ${key}: ${value !== undefined && value !== null ? "Set" : "Not set"}`);
      } else {
        logEntries.push(`  ${key}: ${value}`);
      }
    }
    console.info(logEntries.join("\n"));
  }
}
