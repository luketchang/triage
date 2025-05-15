import { app } from "electron";
import path from "path";

export const LOG_DIR = path.join(app.getPath("userData"), "logs");
export const MIGRATIONS_DIR = path.join(app.getAppPath(), "drizzle");
export const DB_DIR = path.join(app.getPath("userData"), "db");
export const DB_NAME = "triage-chats.db";
