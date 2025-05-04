/**
 * Environment Variables Loader
 *
 * This module loads environment variables from the .env file
 * before @triage/config or any other modules are imported.
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Get directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find project root by traversing up until we find package.json with workspaces
function findProjectRoot(startDir: string): string {
  let currentDir = startDir;
  while (true) {
    // Check if package.json exists
    const packageJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        // If it has workspaces, it's likely the root package.json
        if (packageJson.workspaces) {
          return currentDir;
        }
      } catch (e) {
        // Continue if can't parse package.json
      }
    }

    // Go up one directory
    const parentDir = path.dirname(currentDir);
    // If we've reached the root of the filesystem
    if (parentDir === currentDir) {
      // Fallback to a reasonable guess
      return path.resolve(__dirname, "../../../../");
    }
    currentDir = parentDir;
  }
}

// Find and load .env from project root
const projectRoot = findProjectRoot(__dirname);
const envPath = path.join(projectRoot, ".env");

console.info(`Looking for .env file at: ${envPath}`);

if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.error(`Error loading .env file: ${result.error.message}`);
    process.exit(1);
  }

  // Log that environment variables were loaded
  console.info(`Environment variables loaded from: ${envPath}`);
} else {
  console.error(`Error: .env file not found at: ${envPath}`);
  // Try to create an empty .env file
  try {
    fs.writeFileSync(
      envPath,
      "# Environment variables\n# Add your API keys here\nOPENAI_API_KEY=\nANTHROPIC_API_KEY=\n"
    );
    console.info(`Created an empty .env file at: ${envPath}`);
    console.info("Please add your API keys to the .env file and restart the app.");
  } catch (error) {
    console.error(`Could not create .env file: ${error}`);
  }
  process.exit(1);
}

// Export nothing, this module only has side effects
export {};
