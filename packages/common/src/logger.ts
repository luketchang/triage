import winston from "winston";

/**
 * Simple logger configuration with reasonable defaults.
 * - Logs to console
 * - Uses appropriate log level based on environment
 * - Includes timestamps and basic formatting
 */

// Create a simple format that's easy to read
const simpleFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  process.env.NODE_ENV === "development" ? winston.format.colorize() : winston.format.uncolorize(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

// Create a simple logger with console transport
const createSimpleLogger = (): winston.Logger => {
  return winston.createLogger({
    level: process.env.NODE_ENV === "development" ? "debug" : "info",
    format: simpleFormat,
    transports: [
      new winston.transports.Console({
        stderrLevels: ["error"],
      }),
    ],
  });
};

// Global logger instance that can be overridden by applications
let logger: winston.Logger = createSimpleLogger();

/**
 * Get the current global logger instance.
 */
export function getLogger(): winston.Logger {
  return logger;
}

/**
 * Replace the global logger with a custom configured one.
 * This should be called by applications during their initialization.
 */
export function setLogger(newLogger: winston.Logger): void {
  logger = newLogger;
}

export { logger };
