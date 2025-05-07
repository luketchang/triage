// @ts-ignore - Ignoring React module resolution issues
import { useState } from "react";
// @ts-ignore - Ignoring ReactMarkdown module resolution issues
import ReactMarkdown from "react-markdown";
// @ts-ignore - Ignoring SyntaxHighlighter module resolution issues
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// @ts-ignore - Ignoring vscDarkPlus module resolution issues
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ChevronDownIcon, ChevronRightIcon } from "../icons";
import { cn } from "../lib/utils";
import {
  AssistantMessage as AssistantMessageType,
  CodePostprocessingStage,
  LogPostprocessingStage,
} from "../types";
import FactsSidebar from "./FactsSidebar";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

// Add custom type for ReactMarkdown code component props
interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

interface CellViewProps {
  role: "user" | "assistant";
  content: string;
  stepId?: string;
  steps?: Array<{
    id: string;
    title: string;
    content: string;
  }>;
  // For direct access to the original message if available
  originalMessage?: AssistantMessageType;
}

// Interface for facts extracted from stages
interface Fact {
  title: string;
  content: string;
  type: "log" | "code";
  // Additional fields that might be used later
  sourcePath?: string;
  sourceUrl?: string;
}

function CellView({ role, content, stepId, steps, originalMessage }: CellViewProps) {
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});
  const [showFactsSidebar, setShowFactsSidebar] = useState(false);

  const toggleStep = (id: string) => {
    setOpenSteps((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleFactsSidebar = () => {
    setShowFactsSidebar((prev) => !prev);
  };

  // Determine if this is a step cell
  const isStep = Boolean(stepId);

  // Determine if this is the user or assistant
  const isUser = role === "user";

  // Get facts from the originalMessage if available
  const facts: Fact[] = [];
  if (originalMessage?.stages) {
    // Extract facts from LogPostprocessingStage
    const logPostprocessingStage = originalMessage.stages.find(
      (stage): stage is LogPostprocessingStage => stage.type === "logPostprocessing"
    );

    if (logPostprocessingStage?.facts) {
      logPostprocessingStage.facts.forEach((fact) => {
        facts.push({
          title: fact.title || "Log Fact",
          content: fact.fact,
          type: "log",
        });
      });
    }

    // Extract facts from CodePostprocessingStage
    const codePostprocessingStage = originalMessage.stages.find(
      (stage): stage is CodePostprocessingStage => stage.type === "codePostprocessing"
    );

    if (codePostprocessingStage?.facts) {
      codePostprocessingStage.facts.forEach((fact) => {
        facts.push({
          title: fact.title || "Code Fact",
          content: fact.fact,
          type: "code",
          sourcePath: fact.filepath,
        });
      });
    }
  }

  // Determine if we should show facts button
  const hasFacts = facts.length > 0;

  // Custom Markdown component for code rendering
  const MarkdownContent = ({ content }: { content: string }) => (
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
      {content}
    </ReactMarkdown>
  );

  // Specialized renderers for different stage types
  const renderStageContent = (step: { id: string; title: string; content: string }) => {
    // Try to parse the content if it's JSON (happens with some stage types)
    try {
      const parsedContent = JSON.parse(step.content);

      switch (step.title.toLowerCase()) {
        case "logsearch":
          return (
            <div className="space-y-2">
              {parsedContent.queries?.map((query: any, idx: number) => (
                <div key={idx} className="p-2 bg-gray-800 rounded border border-gray-700">
                  <div className="font-mono text-xs mb-1">Query: {query.input?.query || ""}</div>
                </div>
              )) || <div className="italic text-gray-400">No search queries found</div>}
            </div>
          );

        case "logpostprocessing":
        case "codepostprocessing":
          return (
            <div className="space-y-2">
              {parsedContent.facts?.map((fact: any, idx: number) => (
                <div key={idx} className="p-2 bg-gray-800 rounded border border-gray-700">
                  <div className="font-medium text-sm">{fact.title || "Untitled Fact"}</div>
                  <div className="text-xs mt-1">{fact.fact}</div>
                  {fact.filepath && (
                    <div className="text-xs text-gray-400 mt-1">{fact.filepath}</div>
                  )}
                </div>
              )) || <div className="italic text-gray-400">No facts found</div>}
            </div>
          );

        default:
          // For other types or if parsing fails, just render as markdown
          return <MarkdownContent content={step.content} />;
      }
    } catch (e) {
      // If parsing fails, render as markdown
      return <MarkdownContent content={step.content} />;
    }
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "py-6 px-5 flex flex-col",
          isUser ? "bg-background-user" : "bg-background-assistant"
        )}
      >
        <div className="flex items-start">
          <div
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center mr-4 flex-shrink-0 shadow-sm",
              isUser ? "bg-primary" : "bg-primary-dark"
            )}
          >
            <span className="text-white font-medium">{isUser ? "U" : "A"}</span>
          </div>

          <div className="flex-1 overflow-hidden">
            {isStep && <div className="mb-3 text-sm font-medium text-gray-300">Step {stepId}</div>}

            {/* Facts button - only for assistant messages with facts */}
            {!isUser && hasFacts && (
              <div className="flex justify-end mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFactsSidebar}
                  className="text-xs font-medium hover:bg-background-lighter"
                >
                  {facts.length} Facts {showFactsSidebar ? "◀" : "▶"}
                </Button>
              </div>
            )}

            {/* For assistant messages, first show steps, then response */}
            {!isUser && steps && steps.length > 0 && (
              <div className="mb-6 space-y-2">
                {steps.map((step) => (
                  <Collapsible
                    key={step.id}
                    open={openSteps[step.id]}
                    onOpenChange={() => toggleStep(step.id)}
                    className="border border-border rounded-md overflow-hidden shadow-sm"
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-background-lighter hover:text-white"
                      >
                        <span className="font-medium text-sm">
                          Step {step.id}: {step.title}
                        </span>
                        {openSteps[step.id] ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-4 bg-background-lighter border-t border-border">
                      <div className="prose prose-invert max-w-none">
                        {renderStageContent(step)}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}

            {/* Content (user message or assistant response) */}
            <div className="prose prose-invert max-w-none prose-p:my-3 prose-headings:mt-6 prose-headings:mb-3">
              <MarkdownContent content={content} />
            </div>
          </div>
        </div>
      </div>

      {/* Render FactsSidebar if visible */}
      {!isUser && showFactsSidebar && facts.length > 0 && (
        <div className="absolute top-0 right-0 h-full">
          <FactsSidebar
            facts={facts.map((f) => ({ title: f.title, content: f.content }))}
            toggleFactsSidebar={toggleFactsSidebar}
          />
        </div>
      )}
    </div>
  );
}

export default CellView;
