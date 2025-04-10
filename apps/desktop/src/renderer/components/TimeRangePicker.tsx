import React from "react";
import { TimeRange, TimeRangePreset } from "../types";
import { formatDate } from "../utils/formatters";

interface TimeRangePickerProps {
  timeRange: TimeRange;
  timeRangePresets: TimeRangePreset[];
  onTimeRangeChange: (field: "start" | "end", value: string) => void;
  onTimeRangePreset: (timeMs: number) => void;
}

const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  timeRange,
  timeRangePresets,
  onTimeRangeChange,
  onTimeRangePreset,
}) => {
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

  return (
    <div className="date-pickers">
      <div className="date-picker">
        <input
          type="datetime-local"
          className="date-input"
          value={formatForDateTimeInput(timeRange.start)}
          onChange={(e) => onTimeRangeChange("start", toISOString(e.target.value))}
        />
        <div className="date-display">{formatDate(timeRange.start)}</div>
      </div>
      <span className="date-separator">to</span>
      <div className="date-picker">
        <input
          type="datetime-local"
          className="date-input"
          value={formatForDateTimeInput(timeRange.end)}
          onChange={(e) => onTimeRangeChange("end", toISOString(e.target.value))}
        />
        <div className="date-display">{formatDate(timeRange.end)}</div>
      </div>
    </div>
  );
};

export default TimeRangePicker;
