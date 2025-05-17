import { useAppConfig } from "@renderer/context/useAppConfig.js";
import type { LogSearchToolCall } from "@triage/agent/src/pipeline/state.js";
import { BarChart, ExternalLink, FileCode, Search } from "lucide-react";
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
import { absoluteToRepoRelativePath, filepathToGitHubUrl } from "../utils/facts/code.js";
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
  <div className="mb-6">
    {/* Reasoning */}
    {step.reasoning && (
      <div className="mb-4 text-sm leading-relaxed">
        <Markdown>{step.reasoning}</Markdown>
      </div>
    )}

    {/* Tool calls */}
    {
      <div className="space-y-3">
        {step.data.map((toolCall: LogSearchToolCall, index) => (
          <div
            key={`${step.id}-search-${index}`}
            className="border border-white/20 rounded-md overflow-hidden bg-background-lighter/10 flex items-center justify-between"
          >
            <div className="flex items-center space-x-3 p-2.5 flex-1 overflow-hidden">
              <BarChart size={16} className="text-purple-300 flex-shrink-0" />
              <div className="font-mono text-xs truncate">{toolCall.input.query}</div>
            </div>
            <div className="flex items-center">
              <div className="px-2 py-1 text-xs text-purple-300">
                {toolCall.output && "error" in toolCall.output
                  ? "Error"
                  : toolCall.output && "logs" in toolCall.output
                    ? `${toolCall.output.logs.length} results`
                    : "Processing..."}
              </div>
              {toolCall.output && !("error" in toolCall.output) && (
                <a
                  href={logSearchInputToDatadogLogsViewUrl(toolCall.input)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-700/30 text-gray-300 hover:bg-gray-700/50 hover:text-gray-100 px-3 py-2 text-xs flex items-center transition-colors border-l border-white/10"
                >
                  Open in Datadog <ExternalLink className="ml-1" size={12} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    }
  </div>
);

const CodeSearchStepView: React.FC<{ step: CodeSearchStep }> = ({ step }) => {
  const { appConfig } = useAppConfig();
  if (!appConfig) return null;

  return (
    <div className="mb-6">
      {/* Reasoning */}
      {step.reasoning && (
        <div className="mb-4 text-sm leading-relaxed">
          <Markdown>{step.reasoning}</Markdown>
        </div>
      )}

      {/* Tool calls */}
      {
        <div className="space-y-3">
          {step.data.map((toolCall, index) => {
            // Handle different types of code search tool calls
            if (toolCall.type === "cat") {
              const catToolCall = toolCall;
              const filepath = absoluteToRepoRelativePath(
                appConfig.repoPath!,
                catToolCall.input.path
              );
              console.log("filepath", filepath);
              const output =
                catToolCall.output && !("error" in catToolCall.output) ? catToolCall.output : null;
              const numLines = output ? output.content.split("\n").length : 0;
              return (
                <div
                  key={`${step.id}-search-${index}`}
                  className="border border-white/20 rounded-md overflow-hidden bg-background-lighter/10 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 p-2.5 flex-1 overflow-hidden">
                    <FileCode size={16} className="text-blue-300 flex-shrink-0" />
                    <div className="font-mono text-xs truncate">{filepath}</div>
                  </div>
                  <div className="flex items-center">
                    {output && (
                      <div className="px-2 py-1 text-xs text-blue-300">
                        {numLines} line{numLines !== 1 ? "s" : ""}
                      </div>
                    )}
                    {output && (
                      <a
                        href={filepathToGitHubUrl(appConfig.githubRepoBaseUrl!, filepath)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gray-700/30 text-gray-300 hover:bg-gray-700/50 hover:text-gray-100 px-3 py-2 text-xs flex items-center transition-colors border-l border-white/10"
                      >
                        Open in GitHub <ExternalLink className="ml-1" size={12} />
                      </a>
                    )}
                  </div>
                </div>
              );
            } else if (toolCall.type === "grep") {
              const grepToolCall = toolCall;
              return (
                <div
                  key={`${step.id}-search-${index}`}
                  className="border border-white/20 rounded-md overflow-hidden bg-background-lighter/10 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 p-2.5 flex-1 overflow-hidden">
                    <Search size={16} className="text-blue-300 flex-shrink-0" />
                    <div className="font-mono text-xs truncate">{grepToolCall.input.pattern}</div>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      }
    </div>
  );
};

const ReasoningStepView: React.FC<{ step: ReasoningStep }> = ({ step }) => (
  <div className="mb-6">
    {/* Reasoning */}
    {step.data && (
      <div className="mb-4 text-sm leading-relaxed">
        <Markdown>{step.data}</Markdown>
      </div>
    )}
  </div>
);

const LogPostprocessingStepView: React.FC<{ step: LogPostprocessingStep }> = ({ step }) => (
  <div className="mb-6">
    {/* Title */}
    <div className="mb-3 flex items-center">
      <div className="text-sm font-medium text-transparent bg-shine-white bg-clip-text bg-[length:200%_100%] animate-shine">
        Log Analysis
      </div>
    </div>

    {/* Facts */}
    <div className="space-y-3">
      {step.data.map((fact, index) => (
        <div
          key={`fact-${index}`}
          className="border border-white/20 rounded-md overflow-hidden bg-background-lighter/10 flex flex-col"
        >
          <div className="flex items-center justify-between p-2.5 border-b border-white/10">
            <div className="text-xs font-medium">{fact.title || "Log Fact"}</div>
          </div>
          <div className="p-3">
            <div className="text-xs text-gray-300 overflow-x-auto break-words">{fact.fact}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CodePostprocessingStepView: React.FC<{ step: CodePostprocessingStep }> = ({ step }) => (
  <div className="mb-6">
    {/* Title */}
    <div className="mb-3 flex items-center">
      <div className="text-sm font-medium text-transparent bg-shine-white bg-clip-text bg-[length:200%_100%] animate-shine">
        Code Analysis
      </div>
    </div>

    {/* Facts */}
    <div className="space-y-3">
      {step.data.map((fact, index) => (
        <div
          key={`fact-${index}`}
          className="border border-white/20 rounded-md overflow-hidden bg-background-lighter/10 flex flex-col"
        >
          <div className="flex items-center justify-between p-2.5 border-b border-white/10">
            <div className="text-xs font-medium">{fact.title || "Code Fact"}</div>
          </div>
          <div className="p-3">
            <div className="text-xs text-gray-300 overflow-x-auto break-words">{fact.fact}</div>
            {fact.filepath && <div className="mt-1 text-xs text-gray-500">{fact.filepath}</div>}
          </div>
        </div>
      ))}
    </div>
  </div>
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
