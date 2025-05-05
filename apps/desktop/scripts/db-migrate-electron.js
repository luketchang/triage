const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const BetterSqlite3 = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const { migrate } = require("drizzle-orm/better-sqlite3/migrator");

async function runMigrations() {
  console.info("🔄 Running migrations...");

  const dbPath = path.join(process.cwd(), "db", "triage-chats.db");
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite);

  await migrate(db, {
    migrationsFolder: path.join(__dirname, "..", "drizzle"),
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
