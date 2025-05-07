// @ts-ignore - Ignoring React module resolution issues
import React, { useEffect, useMemo, useRef, useState } from "react";
// @ts-ignore - Ignoring ReactMarkdown module resolution issues
import ReactMarkdown from "react-markdown";
// @ts-ignore - Ignoring SyntaxHighlighter module resolution issues
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// @ts-ignore - Ignoring vscDarkPlus module resolution issues
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "../lib/utils";
import {
  AgentStage,
  AssistantMessage,
  CodePostprocessingStage,
  LogPostprocessingStage,
  LogSearchStage,
  ReasoningStage,
  ReviewStage,
} from "../types";
import FactsSidebar from "./FactsSidebar";

// Add custom type for ReactMarkdown code component props
interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

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
    <div className="step-container border border-border rounded-md overflow-hidden mb-3">
      <div
        className="step-header cursor-pointer p-3 flex justify-between items-center bg-background-lighter"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="step-header-content font-medium text-sm">
          <span>{title}</span>
        </div>
        <span className="collapse-icon">{isCollapsed ? "▼" : "▲"}</span>
      </div>
      {isCollapsed ? (
        <div className="min-h-[8px] w-full" />
      ) : (
        <div
          className="step-content p-4 bg-background prose prose-invert max-w-none"
          ref={contentRef}
        >
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
        <div
          key={`${stage.id}-search-${index}`}
          className="log-search-item mb-2 p-3 bg-background-lighter rounded-md"
        >
          <div className="font-mono text-sm">{query.input.query}</div>
        </div>
      ))
    )}
  </CollapsibleStep>
);

const renderReasoningStage = (stage: ReasoningStage) => (
  <CollapsibleStep title="Reasoning">
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }: CodeProps) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={match[1]}
              PreTag="div"
              className="my-4 rounded-md overflow-auto"
              {...props}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code className={cn("bg-gray-800 px-1 py-0.5 rounded", className)} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {stage.content}
    </ReactMarkdown>
  </CollapsibleStep>
);

const renderReviewStage = (stage: ReviewStage) => (
  <CollapsibleStep title="Review">
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }: CodeProps) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={match[1]}
              PreTag="div"
              className="my-4 rounded-md overflow-auto"
              {...props}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code className={cn("bg-gray-800 px-1 py-0.5 rounded", className)} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {stage.content}
    </ReactMarkdown>
  </CollapsibleStep>
);

const renderLogPostprocessingStage = (stage: LogPostprocessingStage) => (
  <CollapsibleStep title="Log Postprocessing">
    <div className="space-y-3">
      {stage.facts.map((fact, index) => (
        <div
          key={`fact-${index}`}
          className="p-3 bg-background-lighter rounded-md border border-border"
        >
          <div className="font-medium">{fact.title || "Log Fact"}</div>
          <div className="mt-2 text-sm">{fact.fact}</div>
        </div>
      ))}
    </div>
  </CollapsibleStep>
);

const renderCodePostprocessingStage = (stage: CodePostprocessingStage) => (
  <CollapsibleStep title="Code Postprocessing">
    <div className="space-y-3">
      {stage.facts.map((fact, index) => (
        <div
          key={`fact-${index}`}
          className="p-3 bg-background-lighter rounded-md border border-border"
        >
          <div className="font-medium">{fact.title || "Code Fact"}</div>
          <div className="mt-2 text-sm">{fact.fact}</div>
          {fact.filepath && <div className="mt-1 text-xs text-gray-400">{fact.filepath}</div>}
        </div>
      ))}
    </div>
  </CollapsibleStep>
);

function CellView({ message, isThinking = false }: CellViewProps) {
  const [showWaitingIndicator, setShowWaitingIndicator] = useState(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const waitingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Filter stages to only show the ones that should be visible in the UI
  const stages = useMemo(() => message.stages || [], [message.stages]);

  const logPostprocessingStage = useMemo(
    () =>
      stages.find(
        (stage): stage is LogPostprocessingStage => stage.type === "logPostprocessing"
      ) as LogPostprocessingStage | undefined,
    [stages]
  );

  const codePostprocessingStage = useMemo(
    () =>
      stages.find(
        (stage): stage is CodePostprocessingStage => stage.type === "codePostprocessing"
      ) as CodePostprocessingStage | undefined,
    [stages]
  );

  // Determine if we should show facts sidebar - only show when there are actually facts
  const shouldShowFactsSidebar = useMemo(
    () =>
      !isThinking &&
      message.response &&
      ((logPostprocessingStage?.facts?.length || 0) > 0 ||
        (codePostprocessingStage?.facts?.length || 0) > 0),
    [isThinking, message.response, logPostprocessingStage, codePostprocessingStage]
  );

  // Set up a time-based check for showing the waiting indicator
  useEffect(() => {
    if (waitingCheckIntervalRef.current) {
      clearInterval(waitingCheckIntervalRef.current);
      waitingCheckIntervalRef.current = null;
    }

    if (isThinking) {
      lastUpdateTimeRef.current = Date.now();
      setShowWaitingIndicator(false);
      waitingCheckIntervalRef.current = setInterval(() => {
        if (Date.now() - lastUpdateTimeRef.current > 1000) {
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
  }, [isThinking]);

  // Update last update time when cell steps change
  useEffect(() => {
    lastUpdateTimeRef.current = Date.now();
    setShowWaitingIndicator(false);
  }, [stages]);

  return (
    <div className={cn("cellview-container py-6 px-5", shouldShowFactsSidebar ? "with-facts" : "")}>
      {/* Main content area */}
      <div className="cellview-main-content flex-1">
        {/* Render each visible step */}
        {stages.map((stage) => (
          <React.Fragment key={stage.id}>{renderStage(stage)}</React.Fragment>
        ))}

        {/* Show waiting indicator with less restrictive conditions */}
        {isThinking && showWaitingIndicator && (
          <div className="waiting-indicator p-3 text-center text-gray-400">
            <span className="animate-pulse">...</span>
          </div>
        )}

        {/* Render error if present */}
        {message.error && (
          <div className="error-message p-3 my-2 bg-red-900/30 border border-red-700 rounded-md text-red-200">
            {message.error}
          </div>
        )}

        {/* Render final response if present */}
        {message.response && message.response !== "Thinking..." && (
          <div className="response-content prose prose-invert max-w-none">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }: CodeProps) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      className="my-4 rounded-md overflow-auto"
                      {...props}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={cn("bg-gray-800 px-1 py-0.5 rounded", className)} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.response || ""}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Render facts sidebar if facts are available */}
      {shouldShowFactsSidebar && (
        <div className="facts-sidebar-wrapper">
          <FactsSidebar
            logFacts={logPostprocessingStage?.facts || []}
            codeFacts={codePostprocessingStage?.facts || []}
          />
        </div>
      )}
    </div>
  );
}

export default CellView;
