import { logger } from "@triage/common";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import fs from "fs";
import path from "path";

// TODO: we should probably be ensuring backup before migration but skipping for now, should add later

/**
 * Runs database migrations to ensure the schema is up-to-date
 * This should be called during app startup before any database operations
 */
export async function migrateDatabaseIfNeeded(): Promise<void> {
  logger.info("Running database migrations...");

  const userDataPath = app.getPath("userData");
  logger.info(`Using userDataPath: ${userDataPath}`);

  // Create db directory within userDataPath if it doesn't exist
  const dbDir = path.join(userDataPath, "db");
  logger.info(`Database directory target: ${dbDir}`);

  if (!fs.existsSync(dbDir)) {
    logger.info(`Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, "triage-chats.db");
  logger.info(`Database file path: ${dbPath}`);

  // Create and configure the SQLite database instance
  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite);

  // Path to migrations folder
  const migrationsFolderPath = path.join(app.getAppPath(), "drizzle");
  logger.info(`Migrations folder path: ${migrationsFolderPath}`);

  // List SQL files for logging purposes
  const sqlFiles = fs.readdirSync(migrationsFolderPath).filter((f) => f.endsWith(".sql"));
  if (sqlFiles.length > 0) {
    logger.info(`Found ${sqlFiles.length} SQL migration files:`);
    sqlFiles.forEach((file) => logger.info(`  - ${file}`));
  } else {
    logger.info("No SQL migration files found");
  }

  // Apply migrations
  logger.info("Applying database migrations...");
  try {
    migrate(db, { migrationsFolder: migrationsFolderPath });
    logger.info("Database migrations completed successfully");
  } catch (migrationError) {
    logger.error("Database migration failed:", migrationError);
    throw migrationError; // Re-throw to handle in the caller
  } finally {
    // Always close the database connection
    sqlite.close();
  }
}
