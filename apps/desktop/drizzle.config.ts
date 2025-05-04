import type { Config } from "drizzle-kit";
import * as path from "path";

export default {
  schema: "./electron/db/schema.ts", // Path relative to desktop app
  out: "./drizzle", // Output migrations to apps/desktop/drizzle
  driver: "better-sqlite",
  dbCredentials: {
    url: path.join(process.cwd(), "db", "triage-chats.db"),
  },
} satisfies Config;
