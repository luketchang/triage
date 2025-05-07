import { ConfigProvider } from "@triage/config";
import Store from "electron-store";
import { EventEmitter } from "events";
import keytar from "keytar";

const SECRET_KEYS = new Set(["openai.apiKey"]); // Extend as needed

export class ElectronConfigProvider implements ConfigProvider {
  private emitter = new EventEmitter();
  private store = new Store<Record<string, unknown>>();
  private memoryCache = new Map<string, string | undefined>();

  async init(keys: string[]): Promise<void> {
    for (const key of keys) {
      if (this.isSecret(key)) {
        const val = await keytar.getPassword("my-electron-app", key);
        this.memoryCache.set(key, val ?? undefined);
      }
    }
  }
  private isSecret(key: string): boolean {
    return SECRET_KEYS.has(key);
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (this.isSecret(key)) {
      if (!this.memoryCache.has(key)) {
        const val = await keytar.getPassword("my-electron-app", key);
        this.memoryCache.set(key, val ?? undefined);
      }
      return this.memoryCache.get(key) as T;
    }
    return this.store.get(key) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (this.isSecret(key)) {
      await keytar.setPassword("my-electron-app", key, value as string);
      this.memoryCache.set(key, value as string);
    } else {
      this.store.set(key, value);
    }
    this.emitter.emit("change", key);
  }

  onChange(cb: (key: string) => void): void {
    this.emitter.on("change", cb);
  }
}
