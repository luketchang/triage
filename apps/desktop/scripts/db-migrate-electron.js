import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import fs from "fs";
import path from "path";

// Set the app name as early as possible, before app.whenReady()
// This is intended to make app.getPath("userData") return the app-specific path.
app.setName("triage-desktop");

async function runMigrations() {
  console.info("🔄 Running migrations...");

  // IMPORTANT: When running with `pnpm db:migrate` (i.e., `electron ./scripts/...`),
  // app.getName() is "Electron". So app.getPath("userData") will point to
  // a generic Electron data directory, UNLESS app.setName("your-app-name")
  // is called *before app ready*, as we are attempting above.
  const userDataPath = app.getPath("userData");
  console.info("💡 Determined userDataPath (after early app.setName):", userDataPath);
  // To use a specific path for testing (uncomment and modify if needed):
  // const userDataPath = "/Users/luketchang/Library/Application Support/triage-desktop";

  const dbDir = path.join(userDataPath, "db");
  console.info("🔍 Database directory target:", dbDir);

  if (!fs.existsSync(dbDir)) {
    console.info(`🔧 Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, "triage-chats.db");
  console.info("💾 Database file path:", dbPath);

  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite);

  const migrationsFolderPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "drizzle"
  );
  console.info("📂 Migrations folder path:", migrationsFolderPath);

  try {
    console.info(`📄 Listing files in migrations folder (${migrationsFolderPath}):`);
    const files = fs.readdirSync(migrationsFolderPath);
    files.forEach((file) => console.info(`  - ${file}`));
    if (!files.some((f) => f.endsWith(".sql"))) {
      console.warn("⚠️ No .sql files found in migrations folder!");
    }
  } catch (e) {
    console.error("❌ Error listing files in migrations folder:", e);
  }

  try {
    console.info("🚀 Attempting to apply migrations...");
    migrate(db, {
      migrationsFolder: migrationsFolderPath,
    });
    console.info("✅ Migrations reported as complete by Drizzle.");
  } catch (migrationError) {
    console.error("❌❌❌ Error during Drizzle migrate call:", migrationError);
  }

  // Check if tables exist after migration attempt
  try {
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();
    console.info(
      "📋 Tables found in sqlite_master after migration attempt:",
      tables.map((t) => t.name)
    );
    if (
      tables.some(
        (t) => t.name === "chats" || t.name === "assistant_messages" || t.name === "user_messages"
      )
    ) {
      console.info(
        "🎉 At least one expected table ('chats', 'assistant_messages', or 'user_messages') confirmed to exist in DB."
      );
    } else {
      console.warn(
        "🧐 No expected tables found in DB after migration attempt. This suggests migrations did not run successfully."
      );
    }
  } catch (e) {
    console.error("❌ Error querying sqlite_master:", e);
  }

  console.info("🚪 Closing database connection...");
  sqlite.close();
  console.info("Database connection closed.");

  app.quit();
}

app
  .whenReady()
  .then(runMigrations)
  .catch((err) => {
    console.error("❌ Migration script error:", err);
    app.exit(1); // Use app.exit(code) for consistency
  });
