import fs from "fs";
import path from "path";

import { config } from "@triage/config";
import winston, { transports } from "winston";

// Always use a "logs" directory in the project's root directory.
const logDir = path.join(process.cwd(), "logs");

// Ensure the log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Log file path for errors
const errorLogFile = path.join(logDir, "api.error.log");

function getLogger(): winston.Logger {
  return winston.createLogger({
    level: config.env === "development" ? "debug" : "info",
    exitOnError: false,
    format: winston.format.combine(
      // Use built-in error formatting to capture stack traces
      winston.format.errors({ stack: true }),
      winston.format.label({ label: config.processLabel }),
      winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      // Use colorize only in development mode
      config.env === "development" ? winston.format.colorize() : winston.format.uncolorize(),
      winston.format.splat(),
      winston.format.printf(({ level, message, label, timestamp, stack, ...meta }) => {
        // Prefer the stack trace if available
        const logMessage = stack || message;
        // Append metadata if present
        const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
        return `${timestamp} [${label}] ${level}: ${logMessage}${metaString}`;
      })
    ),
    transports: [
      // Console transport for all log levels
      new winston.transports.Console({
        stderrLevels: ["error"],
      }),
      // File transport for error-level logs only
      new transports.File({
        filename: errorLogFile,
        level: "error",
      }),
      // TODO: consistently getting `Error: send EMSGSIZE localhost:8125`, need to fix then turn back on
      // new Syslog({
      //   host: config.ddAgentHost,
      //   port: parseInt(config.ddAgentStatsdPort, 10),
      //   protocol: "udp6",
      //   format: format.json(),
      //   app_name: "node-app",
      // }),
    ],
  });
}

const logger = getLogger();

// Listen for errors on transports to catch any issues with logging
logger.transports.forEach((t) => {
  t.on("error", (err) => {
    console.error("Logger transport error:", err);
  });
});

export { logger };
