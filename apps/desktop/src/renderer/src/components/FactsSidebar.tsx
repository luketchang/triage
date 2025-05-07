// @ts-ignore - Ignoring React module resolution issues
import React from "react";
import { CodePostprocessingFact, LogPostprocessingFact } from "../types";
import { ScrollArea } from "./ui/scroll-area";

interface FactsSidebarProps {
  logFacts: LogPostprocessingFact[];
  codeFacts: CodePostprocessingFact[];
}

const FactsSidebar: React.FC<FactsSidebarProps> = ({ logFacts, codeFacts }) => {
  const hasLogFacts = logFacts.length > 0;
  const hasCodeFacts = codeFacts.length > 0;

  return (
    <div className="w-72 h-full bg-background-sidebar border-l border-border flex flex-col">
      <div className="p-3 border-b border-border flex justify-between items-center">
        <h2 className="font-medium">Facts</h2>
      </div>
      <ScrollArea className="h-full">
        <div className="p-3 space-y-4">
          {/* Log Facts Section */}
          {hasLogFacts && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-primary">Log Facts</h3>
              {logFacts.map((fact, index) => (
                <div
                  key={`log-fact-${index}`}
                  className="p-3 rounded-lg bg-background-lighter border border-border"
                >
                  <h4 className="font-medium text-sm mb-1">{fact.title}</h4>
                  <p className="text-sm text-gray-300">{fact.fact}</p>
                  <div className="mt-1 text-xs text-gray-500">Query: {fact.query}</div>
                </div>
              ))}
            </div>
          )}

          {/* Code Facts Section */}
          {hasCodeFacts && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-primary">Code Facts</h3>
              {codeFacts.map((fact, index) => (
                <div
                  key={`code-fact-${index}`}
                  className="p-3 rounded-lg bg-background-lighter border border-border"
                >
                  <h4 className="font-medium text-sm mb-1">{fact.title}</h4>
                  <p className="text-sm text-gray-300">{fact.fact}</p>
                  <div className="mt-1 text-xs text-gray-500">
                    {fact.filepath} (Lines {fact.startLine}-{fact.endLine})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FactsSidebar;
