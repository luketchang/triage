import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import fs from "fs";
import path from "path";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function runMigrations() {
  console.info("🔄 Running migrations...");

  const userDataPath = app.getPath("userData");
  console.info(`Using userDataPath: ${userDataPath}`);

  // Create db directory within userDataPath if it doesn't exist
  const dbDir = path.join(userDataPath, "db");
  console.info(`Database directory target: ${dbDir}`);

  if (!fs.existsSync(dbDir)) {
    console.info(`Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, "triage-chats.db");
  console.info(`Database file path: ${dbPath}`);

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
