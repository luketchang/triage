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
    const unwrapped = unwrapSchema(schema);
    if (isZodObject(unwrapped)) {
      const shape = (unwrapped._def as any).shape();
      for (const [key, subSchema] of Object.entries(shape)) {
        const fullKey = parentKey ? `${parentKey}.${key}` : key;
        // Check if subSchema is a Zod schema object; we need this beacuse
        // `subSchema instanceof z.ZodType` isn't working
        if (subSchema && typeof subSchema === "object" && "_def" in subSchema) {
          this.registerSchemaRecursively(subSchema as z.ZodTypeAny, fullKey);
        }
      }
    } else if (
      // This should be true if the schema is defined as a `configSecret`
      unwrapped &&
      typeof unwrapped === "object" &&
      "_def" in unwrapped &&
      unwrapped._def.description === "secret"
    ) {
      this.keysForSecretsCache.add(parentKey);
    }
  }

  /**
   * Get all configuration values for a specific schema
   * @param schema The schema to get values for
   */
  async getValues<S>(schema?: z.ZodType<S>): Promise<T | S> {
    const actualSchema = schema ?? this.schema;
    if (!isZodObject(actualSchema)) {
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

  /**
   * Get a config value, either from secure store or electron-store
   */
  private async get(key: string): Promise<ConfigValue> {
    if (this.keysForSecretsCache.has(key)) {
      if (this.secretsCache.has(key)) {
        return this.secretsCache.get(key) as ConfigValue;
      }
      const keytarVal = await keytar.getPassword(KEYTAR_SERVICE_NAME, key);
      const val = keytarVal ?? undefined;
      this.secretsCache.set(key, val);
      return val as ConfigValue;
    }
    return this.store.get(key) as ConfigValue;
  }

  /**
   * Update multiple configuration values at once with validation
   * @param schema The schema to validate against
   * @param values The values to update
   */
  async setValues<S = T>(values: Partial<S>, schema?: z.ZodType<S>): Promise<void> {
    const actualSchema = schema ?? this.schema;
    if (!isZodObject(actualSchema)) {
      throw new Error("Schema must be a ZodObject");
    }
    const validatedValues = (actualSchema as any).partial().parse(values);
    for (const [key, value] of Object.entries(validatedValues)) {
      await this.set(key, value as ConfigValue);
    }
  }

  /**
   * Set a config value, either from secure store or electron-store
   */
  private async set(key: string, value: ConfigValue): Promise<void> {
    if (this.keysForSecretsCache.has(key)) {
      if (!value) {
        await keytar.deletePassword(KEYTAR_SERVICE_NAME, key);
        this.secretsCache.delete(key);
      } else {
        await keytar.setPassword(KEYTAR_SERVICE_NAME, key, value as string);
        this.secretsCache.set(key, value as string);
      }
    } else {
      if (!value) {
        this.store.delete(key);
      } else {
        this.store.set(key, value);
      }
    }
  }
}

/**
 * Helper to check if a Zod schema is a ZodObject
 * @param schema The schema to check
 * @returns True if the schema is an object, false otherwise
 */
function isZodObject(schema: z.ZodTypeAny): boolean {
  return (
    schema &&
    typeof schema === "object" &&
    "_def" in schema &&
    (schema._def as any).typeName === "ZodObject"
  );
}

/**
 * Helper to unwrap ZodOptional, ZodNullable, ZodDefault, etc. to get the innermost schema
 */
function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  while (
    current &&
    ["ZodOptional", "ZodNullable", "ZodDefault"].includes((current._def as any).typeName)
  ) {
    current = (current._def as any).innerType || (current._def as any).schema;
  }
  return current;
}
