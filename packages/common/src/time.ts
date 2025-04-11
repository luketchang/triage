import { logger } from "./logger";

export function toUnixNano(dateStr: string): string {
  // Create Date object from input
  const date = new Date(dateStr);

  const time = date.getTime();
  if (isNaN(time)) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  // Convert to nanoseconds
  return (BigInt(time) * 1000000n).toString();
}

/**
 * Method decorator to measure and log the execution time of a method
 * Similar to Python's @timer decorator
 *
 * Usage:
 * ```
 * class MyClass {
 *   @timer
 *   async myMethod() {
 *     // Method implementation
 *   }
 * }
 * ```
 *
 * @param target The class prototype
 * @param propertyKey The method name
 * @param descriptor The property descriptor
 */
export function timer(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const startTime = Date.now();
    try {
      const result = await originalMethod.apply(this, args);
      const endTime = Date.now();
      const elapsedTime = (endTime - startTime) / 1000; // Convert to seconds
      logger.info(`Time taken by '${propertyKey}': ${elapsedTime.toFixed(4)} seconds`);
      return result;
    } catch (error) {
      const endTime = Date.now();
      const elapsedTime = (endTime - startTime) / 1000; // Convert to seconds
      logger.info(`Time taken by '${propertyKey}' (failed): ${elapsedTime.toFixed(4)} seconds`);
      throw error;
    }
  };

  return descriptor;
}
