import { useAppConfig } from "@renderer/context/useAppConfig.js";
import { BarChart, ExternalLink, FileCode, Loader2, Search } from "lucide-react";
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
  LogSearchToolCallWithResult,
  ReasoningStep,
} from "../types/index.js";
import { absoluteToRepoRelativePath, filepathToGitHubUrl } from "../utils/parse/code.js";
import { logSearchInputToDatadogLogsViewUrl } from "../utils/parse/logs.js";
import AnimatedEllipsis from "./AnimatedEllipsis.jsx";

const GenericStep: React.FC<{ step: AgentStep }> = ({ step }) => {
  switch (step.type) {
    case "logSearch":
      return <LogSearchStepView step={step} />;
    case "codeSearch":
      return <CodeSearchStepView step={step} />;
    case "reasoning":
      return <ReasoningStepView step={step} />;
    default:
      // NOTE: we do not show anything for postprocessing steps
      return null;
  }
};

const LogSearchStepView: React.FC<{ step: LogSearchStep }> = ({ step }) => {
  return (
    <div className="mb-6">
      {/* Reasoning */}
      {step.reasoning && (
        <div className="mb-4 text-sm leading-relaxed search-step-reasoning">
          <Markdown>{step.reasoning}</Markdown>
        </div>
      )}

      {/* Tool calls */}
      {
        <div className="space-y-3">
          {step.data.map((toolCall: LogSearchToolCallWithResult, index) => {
            // Compute display content based on output state
            const resultContent =
              toolCall.output && !("error" in toolCall.output) ? (
                <>
                  <div className="px-2 py-1 text-xs text-purple-300">
                    {`${toolCall.output.logs.length} results`}
                  </div>
                  <a
                    href={logSearchInputToDatadogLogsViewUrl(toolCall.input)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gray-700/30 text-gray-300 hover:bg-gray-700/50 hover:text-gray-100 px-3 py-2 text-xs flex items-center transition-colors border-l border-white/10"
                  >
                    Open in Datadog <ExternalLink className="ml-1" size={12} />
                  </a>
                </>
              ) : (
                <div className="px-2 py-1 text-xs text-gray-300">Failed to fetch logs</div>
              );

            return (
              <div
                key={`${step.id}-search-${index}`}
                className="border border-white/20 rounded-md overflow-hidden bg-background-lighter/10 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3 p-2.5 flex-1 overflow-hidden">
                  <BarChart size={16} className="text-purple-300 flex-shrink-0" />
                  <div className="font-mono text-xs truncate">{toolCall.input.query}</div>
                </div>
                <div className="flex items-center">{resultContent}</div>
              </div>
            );
          })}
        </div>
      }
    </div>
  );
};

const CodeSearchStepView: React.FC<{ step: CodeSearchStep }> = ({ step }) => {
  const { appConfig } = useAppConfig();
  if (!appConfig) return null;

  return (
    <div className="mb-6">
      {/* Reasoning */}
      {step.reasoning && (
        <div className="mb-4 text-sm leading-relaxed search-step-reasoning">
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
              const relativePath = absoluteToRepoRelativePath(
                appConfig.repoPath!,
                catToolCall.input.path
              );

              // Check if the file is outside the repository
              const displayPath = relativePath ? relativePath : catToolCall.input.path;

              // Compute display content based on output state
              const resultContent =
                catToolCall.output && !("error" in catToolCall.output) && relativePath ? (
                  <>
                    <div className="px-2 py-1 text-xs text-blue-300">
                      {`${catToolCall.output.content.split("\n").length} lines`}
                    </div>
                    <a
                      href={filepathToGitHubUrl(appConfig.githubRepoBaseUrl!, displayPath!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-700/30 text-gray-300 hover:bg-gray-700/50 hover:text-gray-100 px-3 py-2 text-xs flex items-center transition-colors border-l border-white/10"
                    >
                      Open in GitHub <ExternalLink className="ml-1" size={12} />
                    </a>
                  </>
                ) : (
                  <div className="px-2 py-1 text-xs text-gray-300">Failed to fetch code</div>
                );

              return (
                <div
                  key={`${step.id}-search-${index}`}
                  className="border border-white/20 rounded-md overflow-hidden bg-background-lighter/10 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 p-2.5 flex-1 overflow-hidden">
                    <FileCode size={16} className="text-blue-300 flex-shrink-0" />
                    <div className="font-mono text-xs truncate">{displayPath}</div>
                  </div>
                  <div className="flex items-center">{resultContent}</div>
                </div>
              );
            } else if (toolCall.type === "grep") {
              const grepToolCall = toolCall;
              // Compute display content based on output state
              const resultContent =
                grepToolCall.output && !("error" in grepToolCall.output) ? (
                  <div className="px-2 py-1 text-xs text-blue-300">
                    {/* NOTE: when using git grep, the number of results is actually the number of lines */}
                    {`${grepToolCall.output.content.split("\n").filter((line) => line.trim() !== "").length} results`}
                  </div>
                ) : (
                  <div className="px-2 py-1 text-xs text-gray-300">Failed to fetch code</div>
                );

              return (
                <div
                  key={`${step.id}-search-${index}`}
                  className="border border-white/20 rounded-md overflow-hidden bg-background-lighter/10 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 p-2.5 flex-1 overflow-hidden">
                    <Search size={16} className="text-blue-300 flex-shrink-0" />
                    <div className="font-mono text-xs truncate">{grepToolCall.input.pattern}</div>
                  </div>
                  <div className="flex items-center">{resultContent}</div>
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

const StatusIndicator: React.FC<{
  text: string;
  isVisible: boolean;
}> = ({ text, isVisible }) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 p-4 rounded-lg bg-background-lighter/20 border border-border/30">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        <div className="text-sm bg-shine-white bg-[length:200%_100%] animate-shine bg-clip-text text-transparent font-medium">
          {text}
        </div>
      </div>
    </div>
  );
};

const PostprocessingSpinner: React.FC<{
  hasLogStep: boolean;
  hasCodeStep: boolean;
  isThinking: boolean;
}> = ({ hasLogStep, hasCodeStep, isThinking }) => {
  return (
    <StatusIndicator
      text="Extracting Facts"
      isVisible={isThinking && (hasLogStep || hasCodeStep)}
    />
  );
};

const ReasoningSpinner: React.FC<{
  hasReasoningStep: boolean;
  isThinking: boolean;
}> = ({ hasReasoningStep, isThinking }) => {
  return <StatusIndicator text="Reasoning" isVisible={isThinking && hasReasoningStep} />;
};

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

        {/* Show reasoning spinner when thinking and last step is reasoning */}
        <ReasoningSpinner
          hasReasoningStep={steps.length > 0 && steps[steps.length - 1]?.type === "reasoning"}
          isThinking={isThinking && showWaitingIndicator}
        />

        {/* Show postprocessing spinner when thinking and postprocessing steps exist */}
        <PostprocessingSpinner
          hasLogStep={!!logPostprocessingStep}
          hasCodeStep={!!codePostprocessingStep}
          isThinking={isThinking}
        />

        {/* Show waiting indicator with simplified logic */}
        {isThinking && showWaitingIndicator && (
          <div className="waiting-indicator p-2 text-left">
            {(() => {
              const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
              const hasPostprocessingSteps = logPostprocessingStep || codePostprocessingStep;

              // Case 1: Last step is reasoning - handled by ReasoningSpinner above
              if (lastStep?.type === "reasoning") {
                return null;
              }

              // Case 2: Has postprocessing steps - handled by PostprocessingSpinner above
              if (hasPostprocessingSteps) {
                return null;
              }

              // Case 3: Default - show animated ellipsis
              return <AnimatedEllipsis />;
            })()}
          </div>
        )}

        {/* Render error if present */}
        {message.error && (
          <div className="error-message p-3 my-2 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm">
            {message.error}
          </div>
        )}

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
    </div>
  );
}

export default CellView;
