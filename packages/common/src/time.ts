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
