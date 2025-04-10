import React, { useEffect, useState } from "react";
import { Artifact, CodeMap } from "../types";

interface CodeViewProps {
  selectedArtifact?: Artifact | null;
}

const CodeView: React.FC<CodeViewProps> = ({ selectedArtifact }) => {
  const [codeFiles, setCodeFiles] = useState<Map<string, string>>(new Map());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");

  useEffect(() => {
    if (selectedArtifact && selectedArtifact.type === "code") {
      try {
        if (selectedArtifact.data instanceof Map) {
          // It's already a Map
          setCodeFiles(selectedArtifact.data as CodeMap);

          // Select the first file by default
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
          // If it's a plain object, convert to Map
          const newCodeMap = new Map();
          Object.entries(selectedArtifact.data).forEach(([key, value]) => {
            newCodeMap.set(key, value as string);
          });

          setCodeFiles(newCodeMap);

          // Select the first file
          if (newCodeMap.size > 0) {
            const firstFile = Array.from(newCodeMap.keys())[0];
            setSelectedFile(firstFile);
            setFileContent(newCodeMap.get(firstFile) || "");
          }
        }
      } catch (error) {
        console.error("Error processing code artifact:", error);
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
              <div className="no-file-selected">Select a file to view its content</div>
            )}
          </div>
        </div>
      ) : (
        <div className="code-placeholder">
          <h2>Code View</h2>
          <p>
            No code artifacts selected. Code artifacts will be displayed here when you select them
            from the chat assistant.
          </p>
        </div>
      )}
    </div>
  );
};

export default CodeView;
