import { ConfigStore } from "@triage/config";
import Store from "electron-store";
import keytar from "keytar";
import { z } from "zod";

const KEYTAR_SERVICE_NAME = "triage-desktop";
type ConfigValue = string | number | boolean | null | undefined;

/**
 * A config store that can store and retrieve config values for a specific schema,
 * using electron-store and keytar (for secrets)
 */
export class ElectronConfigStore<T> implements ConfigStore<T> {
  // Electron-store instance
  private store = new Store<Record<string, ConfigValue>>();
  // Records which keys to store as secrets in keytar, vs in electron-store
  private keysForSecretsCache = new Set<string>();
  // In-memory cache of secrets, to avoid calling keytar for every get
  private secretsCache = new Map<string, string | undefined>();

  /**
   * @param schema Zod schema to store config values for
   */
  constructor(private schema: z.ZodType<T>) {
    this.registerSchemaRecursively(schema);
  }

  /**
   * Records all keys in the schema that should be stored as secrets
   * @param schema The schema to register
   * @param parentKey The parent key of the schema, if this is nested
   */
  private registerSchemaRecursively(schema: z.ZodTypeAny, parentKey: string = ""): void {
    if (schema && schema._def && (schema._def as any).typeName === "ZodObject") {
      const shape = (schema._def as any).shape();
      for (const [key, subSchema] of Object.entries(shape)) {
        const fullKey = parentKey ? `${parentKey}.${key}` : key;
        if (subSchema instanceof z.ZodType) {
          this.registerSchemaRecursively(subSchema, fullKey);
        }
      }
    } else if (schema instanceof z.ZodType && schema._def.description === "secret") {
      this.keysForSecretsCache.add(parentKey);
    }
  }

  /**
   * Get all configuration values for a specific schema
   * @param schema The schema to get values for
   */
  async getValues<S>(schema?: z.ZodType<S>): Promise<T | S> {
    const actualSchema = schema ?? this.schema;
    // Check if it's a ZodObject by looking at the _def.typeName property
    if (
      !actualSchema ||
      !actualSchema._def ||
      (actualSchema._def as any).typeName !== "ZodObject"
    ) {
      throw new Error("Schema must be a ZodObject");
    }
    const result: Record<string, any> = {};
    const shape = (actualSchema._def as any).shape();
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
    if (
      !actualSchema ||
      !actualSchema._def ||
      (actualSchema._def as any).typeName !== "ZodObject"
    ) {
      throw new Error("Schema must be a ZodObject");
    }
    const validatedValues = (actualSchema as any).partial().parse(values);
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
        this.schema &&
        this.schema._def &&
        (this.schema._def as any).typeName === "ZodObject" &&
        (this.schema._def as any).shape()[key]?._def?.description === "secret"
      ) {
        logEntries.push(`  ${key}: ${value !== undefined && value !== null ? "Set" : "Not set"}`);
      } else {
        logEntries.push(`  ${key}: ${value}`);
      }
    }
    console.info(logEntries.join("\n"));
  }
}
