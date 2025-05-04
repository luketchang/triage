import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";
import path from "path";

async function runMigrations() {
  console.info("Running database migrations...");

  // Create db directory if it doesn't exist
  const dbDir = path.join(process.cwd(), "db");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, "triage-chats.db");

  // Connect to the database
  const sqlite = new BetterSqlite3(dbPath);
  const db = drizzle(sqlite);

  // Set pragmas
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");

  // Run migrations
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  try {
    await migrate(db, { migrationsFolder });
    console.info("Migrations completed successfully");
  } catch (error) {
    console.error("Error running migrations:", error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

runMigrations().catch(console.error);
