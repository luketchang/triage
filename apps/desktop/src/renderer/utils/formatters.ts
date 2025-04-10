/**
 * Format a date string to a more readable format
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);

  // Note: The timestamp in the image shows formats like "4/9/2025, 20:22:25"
  // This is M/D/YYYY, HH:MM:SS format with 24-hour time
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds}`;
};

/**
 * Format a timestamp for display
 */
export const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
