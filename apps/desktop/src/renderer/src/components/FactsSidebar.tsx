// @ts-ignore - Ignoring React module resolution issues
import React from "react";
import { useAppConfig } from "../context/useAppConfig.js";
import { filepathToGitHubUrl } from "../utils/parse/code.js";
import { logSearchInputToDatadogLogsViewUrl } from "../utils/parse/logs.js";
import { ScrollArea } from "./ui/ScrollArea.js";

// Fact types from the codebase
import { CodePostprocessingFact, LogPostprocessingFact } from "../types/index.js";

interface FactsSidebarProps {
  logFacts: LogPostprocessingFact[];
  codeFacts: CodePostprocessingFact[];
  onClose?: () => void;
}

const FactsSidebar: React.FC<FactsSidebarProps> = ({ logFacts, codeFacts, onClose }) => {
  const { appConfig, isLoading } = useAppConfig();

  const renderCodeFact = (fact: CodePostprocessingFact, index: number) => {
    if (!appConfig) return null;
    const githubUrl = filepathToGitHubUrl(appConfig.githubRepoBaseUrl!, fact.filepath, {
      startLine: fact.startLine,
      endLine: fact.endLine,
    });
    return (
      <div
        key={`code-fact-${index}`}
        className="p-3 rounded-lg bg-background-lighter border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="font-medium text-sm">{fact.title}</h4>
          <span className="fact-type px-2 py-0.5 text-xs rounded-md bg-blue-900/60 text-blue-200 ml-2">
            CODE
          </span>
        </div>
        <p className="text-sm text-gray-300 mb-1.5 leading-relaxed">{fact.fact}</p>
        <div className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <span>
            {fact.filepath} (Lines {fact.startLine}-{fact.endLine})
          </span>
        </div>
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 hover:underline mt-2 flex items-center gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          View in GitHub
        </a>
      </div>
    );
  };

  const renderLogFact = (fact: LogPostprocessingFact, index: number) => {
    const datadogUrl = logSearchInputToDatadogLogsViewUrl(fact);
    return (
      <div
        key={`log-fact-${index}`}
        className="p-3 rounded-lg bg-background-lighter border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="font-medium text-sm">{fact.title}</h4>
          <span className="fact-type px-2 py-0.5 text-xs rounded-md bg-amber-900/60 text-amber-200 ml-2">
            LOG
          </span>
        </div>
        <p className="text-sm text-gray-300 mb-1.5 leading-relaxed">{fact.fact}</p>
        <div className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Query: {fact.query}</span>
        </div>
        <a
          href={datadogUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-purple-400 hover:text-purple-300 hover:underline mt-2 flex items-center gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
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
      <div className="w-full h-full bg-background-sidebar border-l border-border flex flex-col animate-fade-in">
        <div className="p-3 border-b border-border flex justify-between items-center bg-background-lighter/70 backdrop-blur-sm">
          <h2 className="font-medium text-sm">Facts</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-400 text-sm">Loading facts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background-sidebar border-l border-border flex flex-col animate-fade-in shadow-md">
      <div className="p-3 border-b border-border flex justify-between items-center bg-background-lighter/70 backdrop-blur-sm">
        <h2 className="font-medium text-sm">Facts</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-background-alt text-gray-400 hover:text-white transition-colors"
            aria-label="Close facts panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
      <ScrollArea className="h-full">
        <div className="p-3 space-y-3">
          {logFacts.map(renderLogFact)}
          {codeFacts.map(renderCodeFact)}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FactsSidebar;
