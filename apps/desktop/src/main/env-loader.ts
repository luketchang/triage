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
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);

// Find project root by traversing up until we find a likely root package.json
function findProjectRoot(startDir: string): string {
  let currentDir = startDir;
  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        if (packageJson.pnpm) {
          return currentDir;
        }
      } catch (error) {
        // Continue if can't parse package.json
        console.debug(`Could not parse package.json at ${packageJsonPath}:`, error);
      }
    }

    // Go up one directory
    const parentDir = path.dirname(currentDir);
    // If we've reached the root of the filesystem
    if (parentDir === currentDir) {
      // Fallback to a reasonable guess
      return path.resolve(currentDirPath, "../../../../");
    }
    currentDir = parentDir;
  }
}

process.exit(1);
// Find and load .env from project root
const projectRoot = findProjectRoot(currentDirPath);
const envPath = path.join(projectRoot, ".env");

console.log(`Project root: ${projectRoot}`);
console.log(`Current dir: ${currentDirPath}`);

console.log(`Looking for .env file at: ${envPath}`);

if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.error(`Error loading .env file: ${result.error.message}`);
    process.exit(1);
  }

  // Log that environment variables were loaded
  console.log(`Environment variables loaded from: ${envPath}`);
} else {
  console.error(`Error: .env file not found at: ${envPath}`);
  // Try to create an empty .env file
  try {
    fs.writeFileSync(
      envPath,
      "# Environment variables\n# Add your API keys here\nOPENAI_API_KEY=\nANTHROPIC_API_KEY=\n"
    );
    console.log(`Created an empty .env file at: ${envPath}`);
    console.log("Please add your API keys to the .env file and restart the app.");
  } catch (error) {
    console.error(`Could not create .env file: ${error}`);
  }
  process.exit(1);
}

// Export nothing, this module only has side effects
export {};
