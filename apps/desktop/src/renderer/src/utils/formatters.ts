/**
 * Format a date string to a more readable format
 */
export const formatDate = (dateInput: string | Date): string => {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

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

export const formatDateRange = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Format time as HH:MM
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return `${formatTime(startDate)} - ${formatTime(endDate)}`;
};
