import { ConfigProvider } from "@triage/config";
import { z } from "zod";

export const AgentCfgSchema = z.object({
  agent: z.object({
    name: z.string().default("Agent"),
    enabled: z.boolean().default(true),
  }),
});
export type AgentConfig = z.infer<typeof AgentCfgSchema>;

export class AgentConfigView {
  constructor(private cfg: ConfigProvider) {}

  async get(): Promise<AgentConfig> {
    return AgentCfgSchema.parse({
      agent: {
        name: await this.cfg.get("agent.name"),
        enabled: await this.cfg.get("agent.enabled"),
      },
    });
  }

  async set(partial: Partial<AgentConfig>): Promise<void> {
    if (partial.agent?.name !== undefined) await this.cfg.set("agent.name", partial.agent.name);
    if (partial.agent?.enabled !== undefined)
      await this.cfg.set("agent.enabled", partial.agent.enabled);
  }

  onChange(cb: () => void): void {
    this.cfg.onChange((key: string) => {
      if (key.startsWith("agent.")) cb();
    });
  }
}
