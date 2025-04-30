import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AgentStep, Cell, LogSearchStep, ReasoningStep, ReviewStep } from "../types";

interface CellViewProps {
  cell: Cell;
  isThinking?: boolean;
}

// AnimatedEllipsis component that cycles through ., .., ...
const AnimatedEllipsis = () => {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === ".") return "..";
        if (prev === "..") return "...";
        return ".";
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return <span>{dots}</span>;
};

const styles = {
  container: {
    marginBottom: "16px",
    display: "flex",
    flexDirection: "column" as const,
    width: "100%",
  },
  stepContainer: {
    marginBottom: "12px",
    borderRadius: "6px",
    padding: "10px 12px",
    backgroundColor: "transparent",
    // Remove border to match dark background
  },
  stepHeader: {
    fontWeight: "bold" as const,
    marginBottom: "6px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    userSelect: "none" as const,
    color: "#fff",
  },
  stepHeaderContent: {
    display: "flex",
    alignItems: "center",
  },
  stepIcon: {
    marginRight: "8px",
  },
  stepContent: {
    whiteSpace: "pre-wrap" as const,
    color: "#aaa", // Light grey for intermediate outputs
    fontFamily: "inherit",
    maxHeight: "300px",
    overflowY: "auto" as const,
  },
  logSearchItem: {
    padding: "4px 0",
    fontFamily: "monospace",
    color: "#aaa",
  },
  error: {
    color: "#ff6b6b",
    marginTop: "8px",
    padding: "10px",
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderRadius: "4px",
  },
  response: {
    marginTop: "16px",
    padding: "0",
    backgroundColor: "transparent",
    color: "#fff", // White for final response
    whiteSpace: "pre-wrap" as const,
  },
  collapseIcon: {
    fontSize: "12px",
    color: "#888",
  },
  waitingIndicator: {
    color: "#aaa",
    fontSize: "14px",
    padding: "12px 0",
    fontStyle: "italic",
  },
};

/**
 * Collapsible step container component
 */
const CollapsibleStep: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of content when new content is added
  useEffect(() => {
    if (!isCollapsed && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  });

  return (
    <div style={styles.stepContainer}>
      <div style={styles.stepHeader} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div style={styles.stepHeaderContent}>
          <span>{title}</span>
        </div>
        <span style={styles.collapseIcon}>{isCollapsed ? "▼" : "▲"}</span>
      </div>
      {!isCollapsed && (
        <div style={styles.stepContent} ref={contentRef}>
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Renders a specific type of step in the Cell
 */
const renderStep = (step: AgentStep) => {
  switch (step.type) {
    case "logSearch":
      return renderLogSearchStep(step);
    case "reasoning":
      return renderReasoningStep(step);
    case "review":
      return renderReviewStep(step);
    case "logPostprocessing":
      return null; // Don't render log postprocessing in UI
    case "codePostprocessing":
      return null; // Don't render code postprocessing in UI
    default:
      return null;
  }
};

/**
 * Renders a log search step
 */
const renderLogSearchStep = (step: LogSearchStep) => (
  <CollapsibleStep title="Log Search">
    {step.searches.length === 0 ? (
      <em>Searching logs...</em>
    ) : (
      step.searches.map((search, index) => (
        <div key={`${step.id}-search-${index}`} style={styles.logSearchItem}>
          {search}
        </div>
      ))
    )}
  </CollapsibleStep>
);

/**
 * Renders a reasoning step
 */
const renderReasoningStep = (step: ReasoningStep) => (
  <CollapsibleStep title="Reasoning">
    {step.content ? <ReactMarkdown>{step.content}</ReactMarkdown> : <em>Analyzing...</em>}
  </CollapsibleStep>
);

/**
 * Renders a review step
 */
const renderReviewStep = (step: ReviewStep) => (
  <CollapsibleStep title="Review">
    {step.content ? <ReactMarkdown>{step.content}</ReactMarkdown> : <em>Reviewing...</em>}
  </CollapsibleStep>
);

/**
 * CellView component
 *
 * Displays the content of a Cell, including all its steps and the final response.
 */
const CellView: React.FC<CellViewProps> = ({ cell, isThinking = false }) => {
  const [showWaitingIndicator, setShowWaitingIndicator] = useState(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const waitingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Set up a time-based check for showing the waiting indicator
  useEffect(() => {
    // Clear any existing interval
    if (waitingCheckIntervalRef.current) {
      clearInterval(waitingCheckIntervalRef.current);
      waitingCheckIntervalRef.current = null;
    }

    // Reset last update time when the cell changes (e.g., new step added)
    lastUpdateTimeRef.current = Date.now();

    // Only set up the interval if we're in thinking state and have steps
    if (isThinking && cell.steps.length > 0) {
      waitingCheckIntervalRef.current = setInterval(() => {
        const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
        if (timeSinceLastUpdate > 1000) {
          // Show waiting indicator after 1 second of no updates
          setShowWaitingIndicator(true);
        }
      }, 500);
    } else {
      setShowWaitingIndicator(false);
    }

    return () => {
      if (waitingCheckIntervalRef.current) {
        clearInterval(waitingCheckIntervalRef.current);
      }
    };
  }, [cell, isThinking, visibleSteps.length]);

  // Update last update time when cell steps change
  useEffect(() => {
    lastUpdateTimeRef.current = Date.now();
    setShowWaitingIndicator(false);
  }, [cell.steps]);

  return (
    <div style={styles.container}>
      {/* Render each visible step */}
      {visibleSteps.map((step) => (
        <React.Fragment key={step.id}>{renderStep(step)}</React.Fragment>
      ))}

      {/* Show waiting indicator if needed */}
      {isThinking && showWaitingIndicator && visibleSteps.length > 0 && !cell.response && (
        <div style={styles.waitingIndicator}>
          <AnimatedEllipsis />
        </div>
      )}

      {/* Render error if present */}
      {cell.error && <div style={styles.error}>{cell.error}</div>}

      {/* Render final response if present */}
      {cell.response && (
        <div style={styles.response}>
          <ReactMarkdown>{cell.response}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default CellView;
