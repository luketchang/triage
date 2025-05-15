import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import fs from "fs";
import path from "path";

export const MIGRATIONS_DIR = path.join(app.getAppPath(), "drizzle");
export const DB_DIR = path.join(app.getPath("userData"), "db");
export const DB_NAME = "triage-chats.db";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function runMigrations() {
  console.info("🔄 Running migrations...");

  // Create db directory within userDataPath if it doesn't exist
  console.info(`Database directory target: ${DB_DIR}`);

  if (!fs.existsSync(DB_DIR)) {
    console.info(`Creating database directory: ${DB_DIR}`);
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const dbPath = path.join(DB_DIR, DB_NAME);
  console.info(`Database file path: ${dbPath}`);

  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite);

  migrate(db, {
    migrationsFolder: MIGRATIONS_DIR,
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
