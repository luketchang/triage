const { execSync } = require("child_process");
const { join } = require("path");
const { readdirSync } = require("fs");

const pnpmDir = join(__dirname, "../../../node_modules/.pnpm");
const better = readdirSync(pnpmDir).find((name) => name.startsWith("better-sqlite3@"));
if (!better) {
  console.error("❌ Could not find better-sqlite3 in node_modules/.pnpm");
  process.exit(1);
}

const modPath = join(pnpmDir, better, "node_modules", "better-sqlite3");

try {
  console.log(`🔧 Running prebuild-install for Electron in: ${modPath}`);
  execSync(`npx prebuild-install --runtime=electron --target=35.1.4`, {
    cwd: modPath,
    stdio: "inherit",
  });
} catch (err) {
  console.error("❌ Failed to run prebuild-install");
  process.exit(1);
}
