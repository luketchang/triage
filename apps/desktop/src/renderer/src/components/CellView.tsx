// @ts-ignore - Ignoring React module resolution issues
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "../lib/utils.js";
import {
  AgentStage,
  AssistantMessage,
  CodePostprocessingFact,
  CodePostprocessingStage,
  CodeSearchStage,
  LogPostprocessingFact,
  LogPostprocessingStage,
  LogSearchStage,
  ReasoningStage,
} from "../types/index.js";
import AnimatedEllipsis from "./AnimatedEllipsis.jsx";

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
  onShowFacts?: (logFacts: LogPostprocessingFact[], codeFacts: CodePostprocessingFact[]) => void;
  activeInFactsSidebar?: boolean;
}

/**
 * Collapsible step container component
 */
const CollapsibleStep: React.FC<{
  title: string;
  children: React.ReactNode;
  isActive?: boolean;
}> = ({ title, children, isActive = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of content when new content is added
  useEffect(() => {
    if (!isCollapsed && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  });

  return (
    <div className="step-container border border-border rounded-lg overflow-hidden mb-3 transition-standard shadow-sm">
      <div
        className={cn(
          "step-header cursor-pointer p-2.5 flex justify-between items-center",
          isActive ? "bg-background-lighter" : "bg-background-lighter"
        )}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div
          className={cn(
            "step-header-content font-medium text-sm",
            isActive
              ? "text-transparent bg-shine-white bg-clip-text bg-[length:200%_100%] animate-shine"
              : "text-white"
          )}
        >
          <span>{title}</span>
        </div>
        <span className="collapse-icon text-xs text-gray-400">{isCollapsed ? "▼" : "▲"}</span>
      </div>
      {isCollapsed ? (
        <div className="min-h-[4px] w-full" />
      ) : (
        <div
          className="step-content p-3 bg-background prose prose-invert max-w-none overflow-auto"
          ref={contentRef}
          style={{ maxHeight: "300px" }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

const renderStage = (stage: AgentStage, isActive: boolean = false) => {
  switch (stage.type) {
    case "logSearch":
      return renderLogSearchStage(stage, isActive);
    case "codeSearch":
      return renderCodeSearchStage(stage, isActive);
    case "reasoning":
      return renderReasoningStage(stage, isActive);
    case "logPostprocessing":
      return renderLogPostprocessingStage(stage, isActive);
    case "codePostprocessing":
      return renderCodePostprocessingStage(stage, isActive);
  }
};

const renderLogSearchStage = (stage: LogSearchStage, isActive: boolean = false) => (
  <CollapsibleStep title="Log Search" isActive={isActive}>
    {stage.queries.length === 0 ? (
      <em>Searching logs...</em>
    ) : (
      stage.queries.map((query, index) => (
        <div
          key={`${stage.id}-search-${index}`}
          className="log-search-item mb-2 p-3 bg-background-lighter rounded-lg"
        >
          <div className="font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
            {query.input.query}
          </div>
        </div>
      ))
    )}
  </CollapsibleStep>
);

const renderCodeSearchStage = (stage: CodeSearchStage, isActive: boolean = false) => (
  <CollapsibleStep title="Code Search" isActive={isActive}>
    {stage.retrievedCode.length === 0 ? (
      <em>Searching code...</em>
    ) : (
      stage.retrievedCode.map((code, index) => (
        <div
          key={`${stage.id}-search-${index}`}
          className="code-search-item mb-2 p-3 bg-background-lighter rounded-lg"
        >
          <div className="font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
            {code.filepath}
          </div>
        </div>
      ))
    )}
  </CollapsibleStep>
);

const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  return (
    <div className="relative my-3 rounded-lg overflow-hidden">
      <div className="absolute top-0 right-0 px-2 py-1 text-xs bg-background-alt text-gray-400 rounded-bl-md">
        {language}
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          lineHeight: 1.6,
          padding: "1.5rem 1rem",
        }}
        wrapLines={true}
        wrapLongLines={true}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const renderReasoningStage = (stage: ReasoningStage, isActive: boolean = false) => (
  <CollapsibleStep title="Reasoning" isActive={isActive}>
    <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }: CodeProps) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <CodeBlock language={match[1]} value={String(children).replace(/\n$/, "")} />
            ) : (
              <code
                className={cn("bg-background-alt px-1 py-0.5 rounded text-sm", className)}
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-4 leading-relaxed">{children}</p>;
          },
          pre({ children }) {
            return (
              <pre className="overflow-x-auto whitespace-pre-wrap break-words">{children}</pre>
            );
          },
        }}
      >
        {stage.content}
      </ReactMarkdown>
    </div>
  </CollapsibleStep>
);

const renderLogPostprocessingStage = (stage: LogPostprocessingStage, isActive: boolean = false) => (
  <CollapsibleStep title="Log Postprocessing" isActive={isActive}>
    <div className="space-y-3">
      {stage.facts.map((fact, index) => (
        <div
          key={`fact-${index}`}
          className="p-3 bg-background-lighter rounded-lg border border-border/50 shadow-sm"
        >
          <div className="font-medium text-sm">{fact.title || "Log Fact"}</div>
          <div className="mt-2 text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap break-words">
            {fact.fact}
          </div>
        </div>
      ))}
    </div>
  </CollapsibleStep>
);

const renderCodePostprocessingStage = (
  stage: CodePostprocessingStage,
  isActive: boolean = false
) => (
  <CollapsibleStep title="Code Postprocessing" isActive={isActive}>
    <div className="space-y-3">
      {stage.facts.map((fact, index) => (
        <div
          key={`fact-${index}`}
          className="p-3 bg-background-lighter rounded-lg border border-border/50 shadow-sm"
        >
          <div className="font-medium text-sm">{fact.title || "Code Fact"}</div>
          <div className="mt-2 text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap break-words">
            {fact.fact}
          </div>
          {fact.filepath && <div className="mt-1 text-xs text-gray-500">{fact.filepath}</div>}
        </div>
      ))}
    </div>
  </CollapsibleStep>
);

function CellView({
  message,
  isThinking = false,
  onShowFacts,
  activeInFactsSidebar = false,
}: CellViewProps) {
  const [showWaitingIndicator, setShowWaitingIndicator] = useState(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const waitingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Filter stages to only show the ones that should be visible in the UI
  const stages = useMemo(() => message.stages || [], [message.stages]);

  // Determine which stage is currently active when thinking
  const activeStageIndex = useMemo(() => {
    if (!isThinking || stages.length === 0) return -1;
    return stages.length - 1;
  }, [isThinking, stages]);

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

  // Determine if we have facts to show - only when there are actually facts
  const hasFacts = useMemo(
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

  // Handle opening the facts sidebar
  const handleShowFacts = () => {
    if (onShowFacts && hasFacts) {
      onShowFacts(logPostprocessingStage?.facts || [], codePostprocessingStage?.facts || []);
    }
  };

  return (
    <div
      className={cn(
        "cellview-container py-4 px-4",
        activeInFactsSidebar ? "border-l-2 border-l-primary" : ""
      )}
    >
      {/* Main content area */}
      <div className="cellview-main-content flex-1 w-full min-w-0 overflow-hidden">
        {/* Render each visible step */}
        {stages.map((stage, index) => (
          <React.Fragment key={stage.id}>
            {renderStage(stage, isThinking && index === activeStageIndex)}
          </React.Fragment>
        ))}

        {/* Show waiting indicator with less restrictive conditions */}
        {isThinking && showWaitingIndicator && (
          <div className="waiting-indicator p-2 text-left text-gray-400">
            <AnimatedEllipsis />
          </div>
        )}

        {/* Render error if present */}
        {message.error && (
          <div className="error-message p-3 my-2 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm">
            {message.error}
          </div>
        )}

        {/* Render final response if present */}
        {message.response && message.response !== "Thinking..." && (
          <div className="response-content prose prose-invert max-w-none overflow-wrap-anywhere">
            <div className="text-base leading-relaxed break-words whitespace-pre-wrap overflow-wrap-anywhere min-w-0 max-w-full">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }: CodeProps) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <CodeBlock language={match[1]} value={String(children).replace(/\n$/, "")} />
                    ) : (
                      <code
                        className={cn("bg-background-alt px-1 py-0.5 rounded text-sm", className)}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  p({ children }) {
                    return <p className="mb-4 leading-relaxed">{children}</p>;
                  },
                  pre({ children }) {
                    return (
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words overflow-wrap-anywhere">
                        {children}
                      </pre>
                    );
                  },
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-4">
                        <table className="border-collapse border border-border/60">
                          {children}
                        </table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return (
                      <th className="border border-border/60 bg-background-lighter p-2 text-left font-medium">
                        {children}
                      </th>
                    );
                  },
                  td({ children }) {
                    return <td className="border border-border/60 p-2">{children}</td>;
                  },
                }}
              >
                {message.response || ""}
              </ReactMarkdown>
            </div>

            {/* Facts button - only shown when facts are available */}
            {hasFacts && onShowFacts && (
              <div className="mt-3 flex justify-end">
                <button
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-standard",
                    activeInFactsSidebar
                      ? "bg-primary text-white shadow-sm"
                      : "bg-background-lighter hover:bg-background-alt text-primary border border-border/50"
                  )}
                  onClick={handleShowFacts}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {activeInFactsSidebar ? "Facts Open" : "View Facts"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Facts sidebar is now rendered in ChatView component */}
    </div>
  );
}

export default CellView;
