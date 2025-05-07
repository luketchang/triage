import { EventEmitter } from "events";

import { ConfigProvider } from "./index";

export class InMemoryConfigProvider implements ConfigProvider {
  private store = new Map<string, unknown>();
  private emitter = new EventEmitter();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
    this.emitter.emit("change", key);
  }

  onChange(cb: (key: string) => void): void {
    this.emitter.on("change", cb);
  }
}
