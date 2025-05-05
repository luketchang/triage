import React from "react";
import { CodePostprocessingFact, LogPostprocessingFact } from "../types";
import { filepathToGitHubUrl } from "../utils/facts/code";
import { logSearchInputToDatadogLogsViewUrl } from "../utils/facts/logs";

const GITHUB_REPO_BASE_URL = "https://github.com/luketchang/triage";

interface FactsSidebarProps {
  logFacts: LogPostprocessingFact[];
  codeFacts: CodePostprocessingFact[];
}

const FactsSidebar: React.FC<FactsSidebarProps> = ({ logFacts, codeFacts }) => {
  const renderLogFact = (fact: LogPostprocessingFact, index: number) => {
    // Generate Datadog URL for the log fact
    const datadogUrl = logSearchInputToDatadogLogsViewUrl(fact);

    return (
      <div key={`log-fact-${index}`} className="fact-item log-fact">
        <div className="fact-header">
          <h3 className="fact-title">{fact.title}</h3>
          <span className="fact-type">LOG</span>
        </div>
        <div className="fact-content">
          <p className="fact-text">{fact.fact}</p>
          <a
            href={datadogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fact-link datadog-link"
          >
            View in Datadog
          </a>
        </div>
      </div>
    );
  };

  const renderCodeFact = (fact: CodePostprocessingFact, index: number) => {
    // Generate GitHub URL for the code fact
    const githubUrl = filepathToGitHubUrl(GITHUB_REPO_BASE_URL, fact.filepath);

    return (
      <div key={`code-fact-${index}`} className="fact-item code-fact">
        <div className="fact-header">
          <h3 className="fact-title">{fact.title}</h3>
          <span className="fact-type">CODE</span>
        </div>
        <div className="fact-content">
          <p className="fact-text">{fact.fact}</p>
          <div className="fact-path">{fact.filepath}</div>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fact-link github-link"
          >
            View in GitHub
          </a>
        </div>
      </div>
    );
  };

  // Only render the sidebar if there are facts to show
  if (logFacts.length === 0 && codeFacts.length === 0) {
    return null;
  }

  return (
    <div className="facts-sidebar">
      <div className="facts-header">
        <h2 className="facts-title">Facts</h2>
      </div>
      <div className="facts-content">
        {logFacts.map(renderLogFact)}
        {codeFacts.map(renderCodeFact)}
      </div>
    </div>
  );
};

export default FactsSidebar;
