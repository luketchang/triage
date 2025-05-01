import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AgentStage,
  AssistantMessage,
  CodePostprocessingStage,
  LogPostprocessingStage,
  LogSearchStage,
  ReasoningStage,
  ReviewStage,
} from "../types";
import AnimatedEllipsis from "./AnimatedEllipsis";
import FactsSidebar from "./FactsSidebar";

interface CellViewProps {
  message: AssistantMessage;
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

const renderStage = (stage: AgentStage) => {
  switch (stage.type) {
    case "logSearch":
      return renderLogSearchStage(stage);
    case "reasoning":
      return renderReasoningStage(stage);
    case "review":
      return renderReviewStage(stage);
    case "logPostprocessing":
      return renderLogPostprocessingStage(stage);
    case "codePostprocessing":
      return renderCodePostprocessingStage(stage);
  }
};

const renderLogSearchStage = (stage: LogSearchStage) => (
  <CollapsibleStep title="Log Search">
    {stage.queries.length === 0 ? (
      <em>Searching logs...</em>
    ) : (
      stage.queries.map((query, index) => (
        <div key={`${stage.id}-search-${index}`} className="log-search-item">
          {query.input.query}
        </div>
      ))
    )}
  </CollapsibleStep>
);

const renderReasoningStage = (stage: ReasoningStage) => (
  <CollapsibleStep title="Reasoning">
    <ReactMarkdown>{stage.content}</ReactMarkdown>
  </CollapsibleStep>
);

const renderReviewStage = (stage: ReviewStage) => (
  <CollapsibleStep title="Review">
    <ReactMarkdown>{stage.content}</ReactMarkdown>
  </CollapsibleStep>
);

const renderLogPostprocessingStage = (stage: LogPostprocessingStage) => (
  <CollapsibleStep title="Log Postprocessing">
    <ReactMarkdown>{stage.facts.map((fact) => fact.fact).join("\n")}</ReactMarkdown>
  </CollapsibleStep>
);

const renderCodePostprocessingStage = (stage: CodePostprocessingStage) => (
  <CollapsibleStep title="Code Postprocessing">
    <ReactMarkdown>{stage.facts.map((fact) => fact.fact).join("\n")}</ReactMarkdown>
  </CollapsibleStep>
);

/**
 * CellView component
 *
 * Displays the content of a Cell, including all its steps, the final response,
 * and supporting facts if available.
 */
const CellView: React.FC<CellViewProps> = ({ message, isThinking = false }) => {
  const [showWaitingIndicator, setShowWaitingIndicator] = useState(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const waitingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Filter steps to only show the ones that should be visible in the UI
  const stages = message.stages;
  const logPostprocessing = message.stages.find((stage) => stage.type === "logPostprocessing");
  const codePostprocessing = message.stages.find((stage) => stage.type === "codePostprocessing");

  // Determine if we should show facts sidebar - only show when there are actually facts
  const shouldShowFactsSidebar =
    !isThinking &&
    message.content &&
    ((logPostprocessing?.facts?.length || 0) > 0 || (codePostprocessing?.facts?.length || 0) > 0);

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
    if (isThinking && stages.length > 0) {
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
  }, [message, isThinking, stages.length]);

  // Update last update time when cell steps change
  useEffect(() => {
    lastUpdateTimeRef.current = Date.now();
    setShowWaitingIndicator(false);
  }, [stages]);

  return (
    <div className={`cellview-container ${shouldShowFactsSidebar ? "with-facts" : ""}`}>
      <div className="cellview-main-content">
        {/* Render each visible step */}
        {stages.map((stage) => (
          <React.Fragment key={stage.id}>{renderStage(stage)}</React.Fragment>
        ))}

        {/* Show waiting indicator if needed */}
        {isThinking && showWaitingIndicator && stages.length > 0 && !message.content && (
          <div className="waiting-indicator">
            <AnimatedEllipsis />
          </div>
        )}

        {/* Render error if present */}
        {message.error && <div className="error-message">{message.error}</div>}

        {/* Render final response if present */}
        {message.content && message.content !== "Thinking..." && (
          <div className="response-content">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Render facts sidebar if facts are available */}
      {shouldShowFactsSidebar && (
        <div className="facts-sidebar-wrapper">
          <FactsSidebar
            logFacts={logPostprocessing?.facts || []}
            codeFacts={codePostprocessing?.facts || []}
          />
        </div>
      )}
    </div>
  );
};

export default CellView;
