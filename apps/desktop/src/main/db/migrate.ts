import { logger } from "@triage/common";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import fs from "fs";
import path from "path";

/**
 * Runs database migrations to ensure the schema is up-to-date
 * This should be called during app startup before any database operations
 */
export async function migrateDatabaseIfNeeded(): Promise<void> {
  logger.info("Running database migrations if needed...");

  // Get the user data path from Electron app module
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

  // TODO: this may be wrong path
  const migrationsFolderPath = path.join(app.getAppPath(), "drizzle");
  logger.info(`Migrations folder path: ${migrationsFolderPath}`);

  const needsMigration = needsMigrationCheck(sqlite, migrationsFolderPath);

  if (!needsMigration) {
    logger.info("No database migrations needed, skipping");
    sqlite.close();
    return;
  }

  logger.info("Database needs migration, proceeding with backup and migration");

  // Only back up if migrations are actually needed
  let backupFile: string | undefined;
  if (fs.existsSync(dbPath)) {
    backupFile = path.join(dbDir, `triage-chats.db.bak-${Date.now()}`);
    try {
      fs.copyFileSync(dbPath, backupFile);
      logger.info(
        `Database backup created at ${backupFile} (will be removed if migration succeeds)`
      );
    } catch (backupError) {
      const err = backupError instanceof Error ? backupError : new Error(String(backupError));
      logger.warn(`Failed to create database backup: ${err.message}`);
    }
  }

  // Apply migrations
  logger.info("Applying database migrations...");
  try {
    migrate(db, { migrationsFolder: migrationsFolderPath });
    logger.info("Database migrations completed successfully");

    // Only delete the backup if migration succeeds
    if (backupFile) {
      try {
        fs.unlinkSync(backupFile);
        logger.info(`Removed backup file: ${backupFile}`);
      } catch (removeError) {
        const err = removeError instanceof Error ? removeError : new Error(String(removeError));
        logger.warn(`Failed to remove backup file: ${err.message}`);
      }
    }
  } catch (migrationError) {
    logger.error("Database migration failed:", migrationError);
  }

  // Close the database connection
  sqlite.close();
}

/**
 * Helper function to determine if a migration is needed
 * @param sqlite The SQLite database instance
 * @param migrationsFolderPath The path to the migrations folder
 * @returns Whether a migration is needed
 */
function needsMigrationCheck(
  sqlite: BetterSqlite3.Database,
  migrationsFolderPath: string
): boolean {
  // Check if we need to migrate by looking at drizzle_migrations table
  const hasMigrationsTable = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_drizzle_migrations'")
    .get();

  const sqlFiles = fs.readdirSync(migrationsFolderPath).filter((f) => f.endsWith(".sql"));

  if (sqlFiles.length === 0) {
    logger.info("No SQL migration files found, skipping migration");
    return false;
  }

  logger.info(`Found ${sqlFiles.length} SQL migration files:`);
  sqlFiles.forEach((file) => logger.info(`  - ${file}`));

  const needsMigration =
    !hasMigrationsTable ||
    sqlFiles.some((file) => {
      if (!hasMigrationsTable) return true;

      const isApplied = sqlite
        .prepare("SELECT migration_name FROM _drizzle_migrations WHERE migration_name = ?")
        .get(file);

      return !isApplied;
    });

  return needsMigration;
}
