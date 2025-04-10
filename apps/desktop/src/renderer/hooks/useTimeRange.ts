import { useState } from "react";
import { TimeRange, TimeRangePreset } from "../types";

export const timeRangePresets: TimeRangePreset[] = [
  { label: "Last 15 minutes", value: 15 * 60 * 1000 },
  { label: "Last hour", value: 60 * 60 * 1000 },
  { label: "Last 6 hours", value: 6 * 60 * 60 * 1000 },
  { label: "Last 24 hours", value: 24 * 60 * 60 * 1000 },
  { label: "Last 7 days", value: 7 * 24 * 60 * 60 * 1000 },
];

export function useTimeRange() {
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
    end: new Date().toISOString(), // now
  });

  const handleTimeRangePreset = (timeMs: number) => {
    const end = new Date().toISOString();
    const start = new Date(Date.now() - timeMs).toISOString();
    setTimeRange({ start, end });
    return { start, end };
  };

  const handleTimeRangeChange = (field: "start" | "end", value: string) => {
    setTimeRange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return {
    timeRange,
    setTimeRange,
    handleTimeRangePreset,
    handleTimeRangeChange,
    timeRangePresets,
  };
}
