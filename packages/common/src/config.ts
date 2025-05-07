import { ConfigProvider } from "@triage/config";
import { z } from "zod";

export const CommonCfgSchema = z.object({
  openai: z.object({
    apiKey: z.string().nullable().default(null),
    model: z.string().default("gpt-4o"),
  }),
});
export type CommonConfig = z.infer<typeof CommonCfgSchema>;

export class CommonConfigView {
  constructor(private cfg: ConfigProvider) {}

  async get(): Promise<CommonConfig> {
    return CommonCfgSchema.parse({
      openai: {
        apiKey: await this.cfg.get("openai.apiKey"),
        model: await this.cfg.get("openai.model"),
      },
    });
  }

  async set(partial: Partial<CommonConfig>): Promise<void> {
    if (partial.openai?.apiKey !== undefined)
      await this.cfg.set("openai.apiKey", partial.openai.apiKey);
    if (partial.openai?.model !== undefined)
      await this.cfg.set("openai.model", partial.openai.model);
  }

  onChange(cb: () => void): void {
    this.cfg.onChange((key: string) => {
      if (key.startsWith("openai.")) cb();
    });
  }
}
