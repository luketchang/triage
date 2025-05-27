import { X } from "lucide-react";
import React from "react";
import { ContextItem } from "../types/index.js";
import { formatDateRange } from "../utils/formatters.js";

interface ContextItemViewProps {
  item: ContextItem;
  index: number;
  onRemove?: (index: number) => void;
}

/**
 * Generic component for displaying context items with different inner content based on type
 * Used in both ChatInputArea and ChatView to display context items
 */
function ContextItemView({ item, index, onRemove }: ContextItemViewProps) {
  // Determine the content to display based on item type
  let primaryContent: React.ReactNode;
  let secondaryContent: React.ReactNode;

  if (item.type === "logSearchInput") {
    primaryContent = (
      <span className="font-medium text-gray-300 truncate max-w-[200px]">
        {item.query || "Datadog Log Search"}
      </span>
    );
    secondaryContent = (
      <span className="text-gray-400">{formatDateRange(item.start, item.end)}</span>
    );
  } else {
    primaryContent = (
      <span className="font-medium text-gray-300 truncate max-w-[200px]">
        Sentry Issue: {item.issueId}
      </span>
    );
    secondaryContent = <span className="text-gray-400">{item.eventSpecifier}</span>;
  }

  return (
    <div className="bg-background-alt border border-border rounded-md px-2 py-1 text-xs flex items-center gap-1.5">
      {primaryContent}
      {secondaryContent}
      {onRemove && (
        <button className="text-gray-400 hover:text-gray-200" onClick={() => onRemove(index)}>
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default ContextItemView;
