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
}

function CellView({ role, content, stepId, steps }: CellViewProps) {
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});

  const toggleStep = (id: string) => {
    setOpenSteps((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Determine if this is a step cell
  const isStep = Boolean(stepId);

  // Determine if this is the user or assistant
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "px-4 py-5 flex flex-col",
        isUser ? "bg-background-user" : "bg-background-assistant"
      )}
    >
      <div className="flex items-start">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center mr-3 flex-shrink-0",
            isUser ? "bg-blue-600" : "bg-green-600"
          )}
        >
          <span className="text-white font-medium">{isUser ? "U" : "A"}</span>
        </div>

        <div className="flex-1 overflow-hidden">
          {isStep && <div className="mb-2 text-sm font-medium text-gray-300">Step {stepId}</div>}

          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }: CodeProps) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
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
          </div>

          {steps && steps.length > 0 && (
            <div className="mt-4 space-y-2">
              {steps.map((step) => (
                <Collapsible
                  key={step.id}
                  open={openSteps[step.id]}
                  onOpenChange={() => toggleStep(step.id)}
                  className="border border-border rounded-md overflow-hidden"
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full flex items-center justify-between p-3 text-left"
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
                  <CollapsibleContent className="p-3 bg-background-lighter border-t border-border">
                    <div className="prose prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          code({ node, inline, className, children, ...props }: CodeProps) {
                            const match = /language-(\w+)/.exec(className || "");
                            return !inline && match ? (
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                {...props}
                              >
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
                            ) : (
                              <code
                                className={cn("bg-gray-800 px-1 py-0.5 rounded", className)}
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {step.content}
                      </ReactMarkdown>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CellView;
