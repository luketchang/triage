import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AgentStep, Cell, LogSearchStep, ReasoningStep, ReviewStep } from "../types";
import AnimatedEllipsis from "./AnimatedEllipsis";
import FactsSidebar from "./FactsSidebar";

interface CellViewProps {
  cell: Cell;
  isThinking?: boolean;
}

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
    <div className="step-container">
      <div className="step-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="step-header-content">
          <span>{title}</span>
        </div>
        <span className="collapse-icon">{isCollapsed ? "▼" : "▲"}</span>
      </div>
      {isCollapsed ? (
        // When collapsed, add a placeholder div to maintain width
        <div style={{ minHeight: "8px", width: "100%" }} />
      ) : (
        <div className="step-content" ref={contentRef}>
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
        <div key={`${step.id}-search-${index}`} className="log-search-item">
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
 * Displays the content of a Cell, including all its steps, the final response,
 * and supporting facts if available.
 */
const CellView: React.FC<CellViewProps> = ({ cell, isThinking = false }) => {
  const [showWaitingIndicator, setShowWaitingIndicator] = useState(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const waitingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Filter steps to only show the ones that should be visible in the UI
  const visibleSteps = cell.steps;

  // Determine if we should show facts sidebar
  const shouldShowFactsSidebar =
    !isThinking &&
    cell.response &&
    ((cell.logPostprocessing?.facts.length || 0) > 0 ||
      (cell.codePostprocessing?.facts.length || 0) > 0);

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
    <div className={`cellview-container ${shouldShowFactsSidebar ? "with-facts" : ""}`}>
      <div className="cellview-main-content">
        {/* Render each visible step */}
        {visibleSteps.map((step) => (
          <React.Fragment key={step.id}>{renderStep(step)}</React.Fragment>
        ))}

        {/* Show waiting indicator if needed */}
        {isThinking && showWaitingIndicator && visibleSteps.length > 0 && !cell.response && (
          <div className="waiting-indicator">
            <AnimatedEllipsis />
          </div>
        )}

        {/* Render error if present */}
        {cell.error && <div className="error-message">{cell.error}</div>}

        {/* Render final response if present */}
        {cell.response && (
          <div className="response-content">
            <ReactMarkdown>{cell.response}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Render facts sidebar if facts are available */}
      {shouldShowFactsSidebar && (
        <div className="facts-sidebar-wrapper">
          <FactsSidebar
            logFacts={cell.logPostprocessing?.facts || []}
            codeFacts={cell.codePostprocessing?.facts || []}
          />
        </div>
      )}
    </div>
  );
};

export default CellView;
