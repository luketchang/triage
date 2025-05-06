import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import fs from "fs";
import path from "path";

async function runMigrations() {
  console.info("🔄 Running migrations...");

  const dbPath = path.join(process.cwd(), "db", "triage-chats.db");
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite);

  migrate(db, {
    migrationsFolder: path.join(path.dirname(new URL(import.meta.url).pathname), "..", "drizzle"),
  });

  console.info("✅ Migrations complete.");
  app.quit();
}

app
  .whenReady()
  .then(runMigrations)
  .catch((err) => {
    console.error("❌ Migration error:", err);
    app.exit(1);
  });
