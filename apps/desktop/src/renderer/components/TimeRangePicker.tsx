import React, { useEffect, useState } from "react";
import { TimeRange, TimeRangePreset } from "../types";
import { formatDate } from "../utils/formatters";

export const DEFAULT_START_DATE = new Date("2025-04-16T22:00:00Z");
export const DEFAULT_END_DATE = new Date("2025-04-17T03:00:00Z");

export const timeRangePresets: TimeRangePreset[] = [
  { label: "Default", value: "default" as unknown as number },
  { label: "Last 15 minutes", value: 15 * 60 * 1000 },
  { label: "Last hour", value: 60 * 60 * 1000 },
  { label: "Last 6 hours", value: 6 * 60 * 60 * 1000 },
  { label: "Last 24 hours", value: 24 * 60 * 60 * 1000 },
  { label: "Last 7 days", value: 7 * 24 * 60 * 60 * 1000 },
];

interface TimeRangePickerProps {
  initialTimeRange?: TimeRange;
  onTimeRangeChange: (timeRange: TimeRange) => void;
}

const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  initialTimeRange,
  onTimeRangeChange,
}) => {
  // Initialize with default time range or provided initialTimeRange
  const [timeRange, setTimeRange] = useState<TimeRange>(
    initialTimeRange || {
      start: DEFAULT_START_DATE.toISOString(),
      end: DEFAULT_END_DATE.toISOString(),
    }
  );

  // Update timeRange when initialTimeRange prop changes
  useEffect(() => {
    if (initialTimeRange) {
      setTimeRange(initialTimeRange);
    }
  }, [initialTimeRange]);

  // Convert ISO string to local datetime-local input format
  const formatForDateTimeInput = (isoString: string): string => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Convert from datetime-local format back to ISO
  const toISOString = (localDateString: string): string => {
    const date = new Date(localDateString);
    return date.toISOString();
  };

  const handleTimeFieldChange = (field: "start" | "end", value: string) => {
    const newTimeRange = {
      ...timeRange,
      [field]: value,
    };
    setTimeRange(newTimeRange);
    onTimeRangeChange(newTimeRange);
  };

  const handleTimeRangePreset = (timeMs: number | string) => {
    let newTimeRange: TimeRange;

    // Handle the default preset
    if (timeMs === "default") {
      newTimeRange = {
        start: DEFAULT_START_DATE.toISOString(),
        end: DEFAULT_END_DATE.toISOString(),
      };
    } else {
      // Handle the regular time presets
      const end = DEFAULT_END_DATE.toISOString();
      const startTime = DEFAULT_END_DATE.getTime() - (timeMs as number);
      const start = new Date(startTime).toISOString();
      newTimeRange = { start, end };
    }

    setTimeRange(newTimeRange);
    onTimeRangeChange(newTimeRange);
  };

  return (
    <div className="time-range-control">
      <div className="time-range-presets">
        {timeRangePresets.map((preset) => (
          <button
            key={preset.label}
            className={`time-preset-button ${
              // For default preset, check if both dates match the default
              preset.value === "default" &&
              timeRange.start === DEFAULT_START_DATE.toISOString() &&
              timeRange.end === DEFAULT_END_DATE.toISOString()
                ? "active"
                : ""
            }`}
            onClick={() => handleTimeRangePreset(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="date-pickers-container">
        <div className="date-pickers">
          <div className="date-picker">
            <input
              type="datetime-local"
              className="date-input"
              value={formatForDateTimeInput(timeRange.start)}
              onChange={(e) => handleTimeFieldChange("start", toISOString(e.target.value))}
            />
            <div className="date-display">{formatDate(timeRange.start)}</div>
          </div>
          <span className="date-separator">to</span>
          <div className="date-picker">
            <input
              type="datetime-local"
              className="date-input"
              value={formatForDateTimeInput(timeRange.end)}
              onChange={(e) => handleTimeFieldChange("end", toISOString(e.target.value))}
            />
            <div className="date-display">{formatDate(timeRange.end)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeRangePicker;
