import React from "react";
import ReactMarkdown from "react-markdown";
import {
  AgentStep,
  Cell,
  CodePostprocessingStep,
  LogPostprocessingStep,
  LogSearchStep,
  ReasoningStep,
  ReviewStep,
} from "../types";

interface CellViewProps {
  cell: Cell;
}

const styles = {
  container: {
    marginBottom: "16px",
    display: "flex",
    flexDirection: "column" as const,
    width: "100%",
  },
  stepContainer: {
    marginBottom: "8px",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "10px",
    backgroundColor: "#f8f8f8",
  },
  stepHeader: {
    fontWeight: "bold" as const,
    marginBottom: "6px",
    display: "flex",
    alignItems: "center",
  },
  stepIcon: {
    marginRight: "8px",
  },
  stepContent: {
    whiteSpace: "pre-wrap" as const,
  },
  logSearchItem: {
    padding: "4px 0",
    fontFamily: "monospace",
  },
  error: {
    color: "red",
    marginTop: "8px",
    padding: "10px",
    backgroundColor: "#ffebee",
    borderRadius: "4px",
  },
  response: {
    marginTop: "16px",
    padding: "12px",
    backgroundColor: "#e3f2fd",
    borderRadius: "8px",
    whiteSpace: "pre-wrap" as const,
  },
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
      return renderLogPostprocessingStep(step);
    case "codePostprocessing":
      return renderCodePostprocessingStep(step);
    default:
      return null;
  }
};

/**
 * Renders a log search step
 */
const renderLogSearchStep = (step: LogSearchStep) => (
  <div style={styles.stepContainer}>
    <div style={styles.stepHeader}>
      <span style={styles.stepIcon}>🔍</span>
      <span>Log Search</span>
    </div>
    <div style={styles.stepContent}>
      {step.searches.length === 0 ? (
        <em>Searching logs...</em>
      ) : (
        step.searches.map((search, index) => (
          <div key={`${step.id}-search-${index}`} style={styles.logSearchItem}>
            {search}
          </div>
        ))
      )}
    </div>
  </div>
);

/**
 * Renders a reasoning step
 */
const renderReasoningStep = (step: ReasoningStep) => (
  <div style={styles.stepContainer}>
    <div style={styles.stepHeader}>
      <span style={styles.stepIcon}>🧠</span>
      <span>Reasoning</span>
    </div>
    <div style={styles.stepContent}>
      {step.content ? <ReactMarkdown>{step.content}</ReactMarkdown> : <em>Analyzing...</em>}
    </div>
  </div>
);

/**
 * Renders a review step
 */
const renderReviewStep = (step: ReviewStep) => (
  <div style={styles.stepContainer}>
    <div style={styles.stepHeader}>
      <span style={styles.stepIcon}>✓</span>
      <span>Review</span>
    </div>
    <div style={styles.stepContent}>
      {step.content ? <ReactMarkdown>{step.content}</ReactMarkdown> : <em>Reviewing...</em>}
    </div>
  </div>
);

/**
 * Renders a log postprocessing step
 */
const renderLogPostprocessingStep = (step: LogPostprocessingStep) => (
  <div style={styles.stepContainer}>
    <div style={styles.stepHeader}>
      <span style={styles.stepIcon}>📊</span>
      <span>Log Analysis</span>
    </div>
    <div style={styles.stepContent}>
      {step.content ? <ReactMarkdown>{step.content}</ReactMarkdown> : <em>Analyzing logs...</em>}
    </div>
  </div>
);

/**
 * Renders a code postprocessing step
 */
const renderCodePostprocessingStep = (step: CodePostprocessingStep) => (
  <div style={styles.stepContainer}>
    <div style={styles.stepHeader}>
      <span style={styles.stepIcon}>💻</span>
      <span>Code Analysis</span>
    </div>
    <div style={styles.stepContent}>
      {step.content ? <ReactMarkdown>{step.content}</ReactMarkdown> : <em>Analyzing code...</em>}
    </div>
  </div>
);

/**
 * CellView component
 *
 * Displays the content of a Cell, including all its steps and the final response.
 */
const CellView: React.FC<CellViewProps> = ({ cell }) => {
  return (
    <div style={styles.container}>
      {/* Render each step */}
      {cell.steps.map((step) => (
        <React.Fragment key={step.id}>{renderStep(step)}</React.Fragment>
      ))}

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
