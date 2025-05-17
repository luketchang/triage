import React, { useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "../components/ui/Markdown.js";
import { cn } from "../lib/utils.js";
import {
  AgentStage,
  AssistantMessage,
  CodePostprocessingFact,
  CodePostprocessingStage,
  CodePostprocessingStep,
  CodeSearchStage,
  LogPostprocessingFact,
  LogPostprocessingStage,
  LogPostprocessingStep,
  LogSearchStage,
  ReasoningStage,
} from "../types/index.js";
import AnimatedEllipsis from "./AnimatedEllipsis.jsx";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/Accordion.js";

/**
 * Collapsible step container component
 */
const CollapsibleStep: React.FC<{
  title: string;
  children: React.ReactNode;
  isActive?: boolean;
}> = ({ title, children, isActive = false }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of content when new content is added
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  });

  return (
    <Accordion type="single" collapsible defaultValue="item-1" className="mb-3">
      <AccordionItem
        value="item-1"
        className="border border-border rounded-lg overflow-hidden shadow-sm"
      >
        <AccordionTrigger
          className={cn("p-2.5", isActive ? "bg-background-lighter" : "bg-background-lighter")}
        >
          <div
            className={cn(
              "font-medium text-sm",
              isActive
                ? "text-transparent bg-shine-white bg-clip-text bg-[length:200%_100%] animate-shine"
                : "text-white"
            )}
          >
            {title}
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-0">
          <div
            className="p-3 bg-background prose prose-invert max-w-none overflow-auto"
            ref={contentRef}
            style={{ maxHeight: "300px" }}
          >
            {children}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

const GenericStep: React.FC<{ stage: AgentStage; isActive: boolean }> = ({ stage, isActive }) => {
  switch (stage.type) {
    case "logSearch":
      return <LogSearchStep stage={stage} isActive={isActive} />;
    case "codeSearch":
      return <CodeSearchStep stage={stage} isActive={isActive} />;
    case "reasoning":
      return <ReasoningStep stage={stage} isActive={isActive} />;
    case "logPostprocessing":
      return <LogPostprocessingStep stage={stage} isActive={isActive} />;
    case "codePostprocessing":
      return <CodePostprocessingStep stage={stage} isActive={isActive} />;
  }
};

const LogSearchStep: React.FC<{ stage: LogSearchStage; isActive: boolean }> = ({
  stage,
  isActive,
}) => (
  <CollapsibleStep title="Log Search" isActive={isActive}>
    {stage.steps.length === 0 ? (
      <em>Searching logs...</em>
    ) : (
      stage.steps.map((step, index) => (
        <div
          key={`${stage.id}-search-${index}`}
          className="log-search-item mb-2 p-3 bg-background-lighter rounded-lg"
        >
          <div className="font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
            {/* TODO: properly display */}
            {step.data.map((toolCall) => toolCall.input.query).join("\n")}
          </div>
        </div>
      ))
    )}
  </CollapsibleStep>
);

const CodeSearchStep: React.FC<{ stage: CodeSearchStage; isActive: boolean }> = ({
  stage,
  isActive,
}) => (
  <CollapsibleStep title="Code Search" isActive={isActive}>
    {stage.steps.length === 0 ? (
      <em>Searching code...</em>
    ) : (
      stage.steps.map((step, index) => (
        <div
          key={`${stage.id}-search-${index}`}
          className="code-search-item mb-2 p-3 bg-background-lighter rounded-lg"
        >
          <div className="font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
            {/* TODO: properly display */}
            {step.data
              .map((toolCall) =>
                toolCall.input.type === "catRequest" ? toolCall.input.path : toolCall.input.pattern
              )
              .join("\n")}
          </div>
        </div>
      ))
    )}
  </CollapsibleStep>
);

const ReasoningStep: React.FC<{ stage: ReasoningStage; isActive: boolean }> = ({
  stage,
  isActive,
}) => (
  <CollapsibleStep title="Reasoning" isActive={isActive}>
    <div className="text-sm leading-relaxed break-words">
      <Markdown>{stage.content}</Markdown>
    </div>
  </CollapsibleStep>
);

const LogPostprocessingStep: React.FC<{ stage: LogPostprocessingStage; isActive: boolean }> = ({
  stage,
  isActive,
}) => (
  <CollapsibleStep title="Log Postprocessing" isActive={isActive}>
    <div className="space-y-3">
      {stage.facts.map((fact, index) => (
        <div
          key={`fact-${index}`}
          className="p-3 bg-background-lighter rounded-lg border border-border/50 shadow-sm"
        >
          <div className="font-medium text-sm">{fact.title || "Log Fact"}</div>
          <div className="mt-2 text-sm text-gray-300 overflow-x-auto break-words">{fact.fact}</div>
        </div>
      ))}
    </div>
  </CollapsibleStep>
);

const CodePostprocessingStep: React.FC<{ stage: CodePostprocessingStage; isActive: boolean }> = ({
  stage,
  isActive,
}) => (
  <CollapsibleStep title="Code Postprocessing" isActive={isActive}>
    <div className="space-y-3">
      {stage.facts.map((fact, index) => (
        <div
          key={`fact-${index}`}
          className="p-3 bg-background-lighter rounded-lg border border-border/50 shadow-sm"
        >
          <div className="font-medium text-sm">{fact.title || "Code Fact"}</div>
          <div className="mt-2 text-sm text-gray-300 overflow-x-auto break-words">{fact.fact}</div>
          {fact.filepath && <div className="mt-1 text-xs text-gray-500">{fact.filepath}</div>}
        </div>
      ))}
    </div>
  </CollapsibleStep>
);

interface CellViewProps {
  message: AssistantMessage;
  isThinking?: boolean;
  onShowFacts?: (logFacts: LogPostprocessingFact[], codeFacts: CodePostprocessingFact[]) => void;
  activeInFactsSidebar?: boolean;
}

function CellView({
  message,
  isThinking = false,
  onShowFacts,
  activeInFactsSidebar = false,
}: CellViewProps) {
  const [showWaitingIndicator, setShowWaitingIndicator] = useState(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const waitingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const steps = message.steps;

  const logPostprocessingStep = useMemo(
    () => steps.find((step): step is LogPostprocessingStep => step.type === "logPostprocessing"),
    [steps]
  );

  const codePostprocessingStep = useMemo(
    () => steps.find((step): step is CodePostprocessingStep => step.type === "codePostprocessing"),
    [steps]
  );

  // Determine if we have facts to show - only when there are actually facts
  const hasFacts = useMemo(
    () =>
      !isThinking &&
      message.response &&
      ((logPostprocessingStep?.data?.length || 0) > 0 ||
        (codePostprocessingStep?.data?.length || 0) > 0),
    [isThinking, message.response, logPostprocessingStep, codePostprocessingStep]
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
  }, [steps]);

  // Handle opening the facts sidebar
  const handleShowFacts = () => {
    if (onShowFacts && hasFacts) {
      onShowFacts(logPostprocessingStep?.data || [], codePostprocessingStep?.data || []);
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
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <GenericStep stage={step} isActive={isThinking && index === activeStageIndex} />
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
          <div className="response-content prose prose-invert max-w-none">
            <div className="text-base leading-relaxed break-words min-w-0 max-w-full">
              <Markdown className="prose-base">{message.response || ""}</Markdown>
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
