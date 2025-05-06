#!/usr/bin/env node
import { runCLI } from "../codebase-overviews/cli";

runCLI().catch((error) => {
  console.error("Failed to generate codebase overview:", error);
  process.exit(1);
});
