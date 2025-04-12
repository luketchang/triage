import React, { useEffect, useState } from "react";
import { Artifact, CodeMap } from "../types";

interface CodeViewProps {
  selectedArtifact?: Artifact | null;
}

const CodeView: React.FC<CodeViewProps> = ({ selectedArtifact }) => {
  const [codeFiles, setCodeFiles] = useState<CodeMap>(new Map());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");

  useEffect(() => {
    if (selectedArtifact && selectedArtifact.type === "code") {
      try {
        // Check if it's a Map (CodeMap)
        if (selectedArtifact.data instanceof Map) {
          setCodeFiles(selectedArtifact.data);

          // Select the first file
          if (selectedArtifact.data.size > 0) {
            const firstFile = Array.from(selectedArtifact.data.keys())[0];
            setSelectedFile(firstFile);
            setFileContent(selectedArtifact.data.get(firstFile) || "");
          }
        } else if (typeof selectedArtifact.data === "string") {
          // If it's a JSON string, try to parse it
          try {
            const parsedData = JSON.parse(selectedArtifact.data);
            const newCodeMap = new Map();

            // Convert the parsed object to a Map
            Object.entries(parsedData).forEach(([key, value]) => {
              newCodeMap.set(key, value as string);
            });

            setCodeFiles(newCodeMap);

            // Select the first file
            if (newCodeMap.size > 0) {
              const firstFile = Array.from(newCodeMap.keys())[0];
              setSelectedFile(firstFile);
              setFileContent(newCodeMap.get(firstFile) || "");
            }
          } catch (parseError) {
            console.error("Error parsing code artifact data:", parseError);

            // If it's not JSON, treat it as a single code file
            const newCodeMap = new Map();
            newCodeMap.set("code.txt", selectedArtifact.data as string);
            setCodeFiles(newCodeMap);
            setSelectedFile("code.txt");
            setFileContent(selectedArtifact.data as string);
          }
        } else if (typeof selectedArtifact.data === "object" && selectedArtifact.data !== null) {
          // For object-based CodeMap (but not LogSearchPair which would be a log type)
          const newCodeMap = new Map();

          // Safely convert to Map
          try {
            // Handle object entries
            Object.entries(selectedArtifact.data).forEach(([key, value]) => {
              // Cast value to string or stringify
              newCodeMap.set(key, typeof value === "string" ? value : JSON.stringify(value));
            });

            setCodeFiles(newCodeMap);

            // Select the first file
            if (newCodeMap.size > 0) {
              const firstFile = Array.from(newCodeMap.keys())[0];
              setSelectedFile(firstFile);
              setFileContent(newCodeMap.get(firstFile) || "");
            }
          } catch (error) {
            console.error("Error handling code data:", error);
          }
        }
      } catch (error) {
        console.error("Error loading code artifact:", error);
      }
    }
  }, [selectedArtifact]);

  const handleFileSelect = (filename: string) => {
    setSelectedFile(filename);
    setFileContent(codeFiles.get(filename) || "");
  };

  return (
    <div className="code-view">
      {selectedArtifact && selectedArtifact.type === "code" ? (
        <div className="code-explorer">
          <div className="file-browser">
            <h3>Files</h3>
            <div className="file-list">
              {Array.from(codeFiles.keys()).map((filename) => (
                <div
                  key={filename}
                  className={`file-item ${selectedFile === filename ? "selected" : ""}`}
                  onClick={() => handleFileSelect(filename)}
                >
                  {filename}
                </div>
              ))}
            </div>
          </div>
          <div className="code-content">
            {selectedFile ? (
              <>
                <div className="code-header">
                  <h3>{selectedFile}</h3>
                </div>
                <pre className="code-display">{fileContent}</pre>
              </>
            ) : (
              <div className="no-file-selected">
                <p>No file selected. Please select a file from the list.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="code-placeholder">
          <h2>Code View</h2>
          <p>Select a code artifact to view its contents.</p>
        </div>
      )}
    </div>
  );
};

export default CodeView;
