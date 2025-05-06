import React, { useEffect, useState } from "react";
import { useAppConfig } from "../context/AppConfigContext";
import { CodePostprocessingFact, LogPostprocessingFact } from "../types";
import { filepathToGitHubUrl } from "../utils/facts/code";
import { logSearchInputToDatadogLogsViewUrl } from "../utils/facts/logs";

interface FactsSidebarProps {
  logFacts: LogPostprocessingFact[];
  codeFacts: CodePostprocessingFact[];
}

const FactsSidebar: React.FC<FactsSidebarProps> = ({ logFacts, codeFacts }) => {
  const { config, isLoading } = useAppConfig();
  const [codeFactElements, setCodeFactElements] = useState<React.ReactNode[]>([]);

  // Generate code fact elements when config loads or facts change
  useEffect(() => {
    const generateCodeFacts = async () => {
      if (isLoading || !config) return;

      const elements = codeFacts.map((fact, index) => {
        // Generate GitHub URL for the code fact
        const githubUrl = filepathToGitHubUrl(config.githubRepoBaseUrl, fact.filepath, {
          startLine: fact.startLine,
          endLine: fact.endLine,
        });

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
      });

      setCodeFactElements(elements);
    };

    generateCodeFacts();
  }, [codeFacts, config, isLoading]);

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

  // Only render the sidebar if there are facts to show
  if (logFacts.length === 0 && codeFacts.length === 0) {
    return null;
  }

  // Show loading state if config is still loading
  if (isLoading) {
    return (
      <div className="facts-sidebar">
        <div className="facts-header">
          <h2 className="facts-title">Facts</h2>
        </div>
        <div className="facts-content">
          <p>Loading facts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="facts-sidebar">
      <div className="facts-header">
        <h2 className="facts-title">Facts</h2>
      </div>
      <div className="facts-content">
        {logFacts.map(renderLogFact)}
        {codeFactElements}
      </div>
    </div>
  );
};

export default FactsSidebar;
