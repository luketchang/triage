import { useAppConfig } from "@renderer/context/useAppConfig.js";
import type {
  CatToolCall,
  CodeSearchToolCall,
  GrepToolCall,
  LogSearchToolCall,
} from "@triage/agent/src/pipeline/state.js";
import { ExternalLink } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "../components/ui/Markdown.js";
import { cn } from "../lib/utils.js";
import {
  AgentStep,
  AssistantMessage,
  CodePostprocessingFact,
  CodePostprocessingStep,
  CodeSearchStep,
  LogPostprocessingFact,
  LogPostprocessingStep,
  LogSearchStep,
  ReasoningStep,
} from "../types/index.js";
import { filepathToGitHubUrl } from "../utils/facts/code.js";
import { logSearchInputToDatadogLogsViewUrl } from "../utils/facts/logs.js";
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

const GenericStep: React.FC<{ step: AgentStep }> = ({ step }) => {
  switch (step.type) {
    case "logSearch":
      return <LogSearchStepView step={step} />;
    case "codeSearch":
      return <CodeSearchStepView step={step} />;
    case "reasoning":
      return <ReasoningStepView step={step} />;
    case "logPostprocessing":
      return <LogPostprocessingStepView step={step} />;
    case "codePostprocessing":
      return <CodePostprocessingStepView step={step} />;
  }
};

const LogSearchStepView: React.FC<{ step: LogSearchStep }> = ({ step }) => (
  <CollapsibleStep title="Log Search">
    {/* Show reasoning */}
    {step.reasoning && (
      <div className="mb-4 p-3 bg-background-lighter rounded-lg">
        <div className="font-medium text-sm mb-1">Reasoning:</div>
        <div className="text-sm leading-relaxed break-words">
          <Markdown>{step.reasoning}</Markdown>
        </div>
      </div>
    )}

    {step.data.length === 0 ? (
      <em>Searching logs...</em>
    ) : (
      step.data.map((toolCall: LogSearchToolCall, index) => (
        <div
          key={`${step.id}-search-${index}`}
          className="log-search-item mb-2 p-3 bg-background-lighter rounded-lg"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="font-medium text-sm">Log Search Query</div>
            <div className="text-xs px-2 py-1 bg-blue-900/30 text-blue-300 rounded-full">
              {toolCall.output && "error" in toolCall.output
                ? "Error"
                : toolCall.output && "logs" in toolCall.output
                  ? `${toolCall.output.logs.length} results`
                  : "Processing..."}
            </div>
          </div>
          <div className="font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words mb-2">
            {toolCall.input.query}
          </div>
          {toolCall.output && !("error" in toolCall.output) && (
            <a
              href={logSearchInputToDatadogLogsViewUrl(toolCall.input)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs flex items-center text-blue-300 hover:text-blue-100 transition-colors"
            >
              View in Datadog <ExternalLink className="ml-1" size={12} />
            </a>
          )}
        </div>
      ))
    )}
  </CollapsibleStep>
);

const CodeSearchStepView: React.FC<{ step: CodeSearchStep }> = ({ step }) => {
  const { appConfig } = useAppConfig();
  if (!appConfig) return null;

  return (
    <CollapsibleStep title="Code Search">
      {/* Show reasoning */}
      {step.reasoning && (
        <div className="mb-4 p-3 bg-background-lighter rounded-lg">
          <div className="font-medium text-sm mb-1">Reasoning:</div>
          <div className="text-sm leading-relaxed break-words">
            <Markdown>{step.reasoning}</Markdown>
          </div>
        </div>
      )}

      {step.data.length === 0 ? (
        <em>Searching code...</em>
      ) : (
        step.data.map((toolCall: CodeSearchToolCall, index) => {
          // Handle different types of code search tool calls
          if (toolCall.type === "cat") {
            const catToolCall = toolCall as CatToolCall;
            const filepath = catToolCall.input.path;
            const output =
              catToolCall.output && !("error" in catToolCall.output) ? catToolCall.output : null;
            const numLines = output ? output.content.split("\n").length : 0;
            return (
              <div
                key={`${step.id}-search-${index}`}
                className="code-search-item mb-2 p-3 bg-background-lighter rounded-lg"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-sm">Cat Request</div>
                  {output && (
                    <div className="text-xs px-2 py-1 bg-purple-900/30 text-purple-300 rounded-full">
                      {numLines} line{numLines !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
                <div className="font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words mb-2">
                  {filepath}
                </div>
                {output && (
                  <a
                    href={filepathToGitHubUrl(appConfig.githubRepoBaseUrl!, filepath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs flex items-center text-purple-300 hover:text-purple-100 transition-colors"
                  >
                    View in GitHub <ExternalLink className="ml-1" size={12} />
                  </a>
                )}
              </div>
            );
          } else if (toolCall.type === "grep") {
            const grepToolCall = toolCall as GrepToolCall;
            return (
              <div
                key={`${step.id}-search-${index}`}
                className="code-search-item mb-2 p-3 bg-background-lighter rounded-lg"
              >
                <div className="font-medium text-sm mb-2">Grep Search</div>
                <div className="font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
                  {grepToolCall.input.pattern}
                </div>
              </div>
            );
          }

          return null;
        })
      )}
    </CollapsibleStep>
  );
};

const ReasoningStepView: React.FC<{ step: ReasoningStep }> = ({ step }) => (
  <CollapsibleStep title="Reasoning">
    <div className="text-sm leading-relaxed break-words">
      <Markdown>{step.data}</Markdown>
    </div>
  </CollapsibleStep>
);

const LogPostprocessingStepView: React.FC<{ step: LogPostprocessingStep }> = ({ step }) => (
  <CollapsibleStep title="Log Analysis" isActive={true}>
    <div className="text-sm mb-3 flex items-center">
      <span className="text-transparent bg-shine-white bg-clip-text bg-[length:200%_100%] animate-shine">
        Analyzing logs
      </span>
      <AnimatedEllipsis />
    </div>
    <div className="space-y-3">
      {step.data.map((fact, index) => (
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

const CodePostprocessingStepView: React.FC<{ step: CodePostprocessingStep }> = ({ step }) => (
  <CollapsibleStep title="Code Analysis" isActive={true}>
    <div className="text-sm mb-3 flex items-center">
      <span className="text-transparent bg-shine-white bg-clip-text bg-[length:200%_100%] animate-shine">
        Analyzing code
      </span>
      <AnimatedEllipsis />
    </div>
    <div className="space-y-3">
      {step.data.map((fact, index) => (
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
          <React.Fragment key={step.id}>
            <GenericStep step={step} />
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
