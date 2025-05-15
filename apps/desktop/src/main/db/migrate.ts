import { logger } from "@triage/common";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";
import path from "path";
import { DB_DIR, DB_NAME, MIGRATIONS_DIR } from "../constants.js";

// TODO: we should probably be ensuring backup before migration but skipping for now, should add later

/**
 * Runs database migrations to ensure the schema is up-to-date
 * This should be called during app startup before any database operations
 */
export async function migrateDatabaseIfNeeded(): Promise<void> {
  logger.info("Running database migrations...");

  if (!fs.existsSync(DB_DIR)) {
    logger.info(`Creating database directory: ${DB_DIR}`);
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const dbPath = path.join(DB_DIR, DB_NAME);
  logger.info(`Database file path: ${dbPath}`);

  // Create and configure the SQLite database instance
  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite);

  // Path to migrations folder
  logger.info(`Migrations folder path: ${MIGRATIONS_DIR}`);

  // List SQL files for logging purposes
  const sqlFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  if (sqlFiles.length > 0) {
    logger.info(`Found ${sqlFiles.length} SQL migration files:`);
    sqlFiles.forEach((file) => logger.info(`  - ${file}`));
  } else {
    logger.info("No SQL migration files found");
  }

  // Apply migrations
  logger.info("Applying database migrations...");
  try {
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    logger.info("Database migrations completed successfully");
  } catch (migrationError) {
    logger.error("Database migration failed:", migrationError);
    throw migrationError; // Re-throw to handle in the caller
  } finally {
    // Always close the database connection
    sqlite.close();
  }
}
