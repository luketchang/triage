/**
 * Desktop app logger configuration
 * Configures Winston logger with appropriate transports for the Electron app
 */

import fs from "fs";
import path from "path";

import { setLogger } from "@triage/common";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

import { LOG_DIR } from "../constants.js";

const logFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.uncolorize(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

/**
 * Sets up the logger for the Electron desktop app.
 * This should be called early in the app initialization process, before
 * any code that might use the logger is executed.
 */
export function setupDesktopLogger(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (_err) {
    console.error("Failed to create log directory:", LOG_DIR);
  }

  // Configure transports
  const transports: winston.transport[] = [
    // Console transport for all levels
    new winston.transports.Console({
      level: "info",
      stderrLevels: ["error"],
    }),
  ];

  // Add file transports with rotation if log directory is available
  if (fs.existsSync(LOG_DIR)) {
    // Error logs with daily rotation (error level only)
    transports.push(
      new DailyRotateFile({
        filename: path.join(LOG_DIR, "error-%DATE%.log"),
        datePattern: "YYYY-MM-DD",
        level: "error",
        maxSize: "20m",
        maxFiles: "14d", // retain for 14 days
        format: logFormat,
        zippedArchive: true,
      })
    );
    // Combined logs with daily rotation (all levels)
    transports.push(
      new DailyRotateFile({
        filename: path.join(LOG_DIR, "combined-%DATE%.log"),
        datePattern: "YYYY-MM-DD",
        level: "info",
        maxSize: "50m",
        maxFiles: "7d", // retain for 7 days
        format: logFormat,
        zippedArchive: true,
      })
    );
  }

  // Create the desktop-specific logger with appropriate options
  const desktopLogger = winston.createLogger({
    level: process.env.NODE_ENV === "development" ? "debug" : "info",
    format: logFormat,
    defaultMeta: { app: "triage-desktop" },
    transports,
  });

  // Set as the global logger for all packages to use
  setLogger(desktopLogger);
}
