// @ts-ignore - Ignoring React module resolution issues
import React, { useEffect, useState } from "react";
import { useAppConfig } from "../context/AppConfigContext";
import { filepathToGitHubUrl } from "../utils/facts/code";
import { logSearchInputToDatadogLogsViewUrl } from "../utils/facts/logs";
import { ScrollArea } from "./ui/scroll-area";

// Fact types from the codebase
import { CodePostprocessingFact, LogPostprocessingFact } from "../types";

interface FactsSidebarProps {
  logFacts: LogPostprocessingFact[];
  codeFacts: CodePostprocessingFact[];
}

const FactsSidebar: React.FC<FactsSidebarProps> = ({ logFacts, codeFacts }) => {
  const { config, isLoading } = useAppConfig();
  const [codeFactElements, setCodeFactElements] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    if (isLoading || !config) return;
    const elements = codeFacts.map((fact, index) => {
      const githubUrl = filepathToGitHubUrl(config.githubRepoBaseUrl, fact.filepath, {
        startLine: fact.startLine,
        endLine: fact.endLine,
      });
      return (
        <div
          key={`code-fact-${index}`}
          className="p-3 rounded-lg bg-background-lighter border border-border"
        >
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium text-sm">{fact.title}</h4>
            <span className="fact-type px-2 py-0.5 text-xs rounded bg-blue-900 text-blue-300 ml-2">
              CODE
            </span>
          </div>
          <p className="text-sm text-gray-300 mb-1">{fact.fact}</p>
          <div className="mt-1 text-xs text-gray-500">
            {fact.filepath} (Lines {fact.startLine}-{fact.endLine})
          </div>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-blue-400 hover:underline mt-1"
          >
            View in GitHub
          </a>
        </div>
      );
    });
    setCodeFactElements(elements);
  }, [codeFacts, config, isLoading]);

  const renderLogFact = (fact: LogPostprocessingFact, index: number) => {
    const datadogUrl = logSearchInputToDatadogLogsViewUrl(fact);
    return (
      <div
        key={`log-fact-${index}`}
        className="p-3 rounded-lg bg-background-lighter border border-border"
      >
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-medium text-sm">{fact.title}</h4>
          <span className="fact-type px-2 py-0.5 text-xs rounded bg-amber-900 text-amber-300 ml-2">
            LOG
          </span>
        </div>
        <p className="text-sm text-gray-300 mb-1">{fact.fact}</p>
        <div className="mt-1 text-xs text-gray-500">Query: {fact.query}</div>
        <a
          href={datadogUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-purple-400 hover:underline mt-1"
        >
          View in Datadog
        </a>
      </div>
    );
  };

  if (logFacts.length === 0 && codeFacts.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="w-72 h-full bg-background-sidebar border-l border-border flex flex-col">
        <div className="p-3 border-b border-border flex justify-between items-center">
          <h2 className="font-medium">Facts</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-400">Loading facts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 h-full bg-background-sidebar border-l border-border flex flex-col">
      <div className="p-3 border-b border-border flex justify-between items-center">
        <h2 className="font-medium">Facts</h2>
      </div>
      <ScrollArea className="h-full">
        <div className="p-3 space-y-4">
          {logFacts.map(renderLogFact)}
          {codeFactElements}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FactsSidebar;
