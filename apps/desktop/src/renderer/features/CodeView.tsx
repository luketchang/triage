import Editor from "@monaco-editor/react";
import React, { Component, ErrorInfo, useCallback, useEffect, useRef, useState } from "react";
import { FileTree } from "../components/FileTree";
import { useCode } from "../hooks/useCode";
import api from "../services/api";
import { Artifact, EnhancedCodeMap } from "../types";
import { File, findFileByPath } from "../utils/file-manager";

// Default file to open when the repository is loaded (optional)
// Set to null or empty string to not auto-open any file
const DEFAULT_FILE_TO_OPEN = "";

/**
 * Extract file and repository information from a code artifact.
 * This is needed because code artifacts can store file paths in different ways.
 */
function getFileInfoFromArtifact(
  codeData: EnhancedCodeMap,
  configRepoPath: string
): {
  repoPath: string | null;
  filePath: string | null;
} {
  // First try to use explicit properties if they exist
  const repoPath = codeData.repoPath || configRepoPath || null;

  // Check if there's an explicit filePath
  if (codeData.filePath) {
    return {
      repoPath,
      filePath: codeData.filePath,
    };
  }

  // Otherwise, if the CodeMap contains exactly one entry,
  // use the key (first item) as the file path
  if (codeData.size === 1) {
    const firstEntry = codeData.entries().next().value;
    if (firstEntry && typeof firstEntry[0] === "string") {
      return {
        repoPath,
        filePath: firstEntry[0],
      };
    }
  }

  // If the CodeMap has multiple entries, it's probably representing multiple files
  // In this case, we don't know which one to open
  if (codeData.size > 1) {
    console.warn("Code artifact contains multiple files but no specific filePath");
    // Get the first entry as a fallback
    const firstEntry = codeData.entries().next().value;
    if (firstEntry && typeof firstEntry[0] === "string") {
      return {
        repoPath,
        filePath: firstEntry[0],
      };
    }
  }

  // If we get here, we couldn't determine a valid file path
  return { repoPath, filePath: null };
}

// ErrorBoundary component to catch errors and prevent app crashes
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CodeView error boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="code-placeholder error">
          <h3>Something went wrong with the Code View</h3>
          <p>{this.state.errorMessage}</p>
          <button onClick={() => this.setState({ hasError: false })}>Try Again</button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper for the Monaco editor with better error handling
const SafeMonacoEditor = ({
  language,
  content,
  path,
}: {
  language: string;
  content: string;
  path: string;
}) => {
  const [editorError, setEditorError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const editorInstanceRef = useRef<any>(null);

  // Recalculate editor layout when window is resized
  useEffect(() => {
    const handleResize = () => {
      if (editorInstanceRef.current) {
        setTimeout(() => editorInstanceRef.current?.layout(), 50);
      }
    };
    window.addEventListener("resize", handleResize);
    if (editorInstanceRef.current) {
      setTimeout(() => editorInstanceRef.current?.layout(), 100);
    }
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleEditorBeforeMount = (monaco: any) => {
    try {
      monaco.editor.defineTheme("triage-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#1e1e1e",
          "editor.foreground": "#d4d4d4",
          "editorCursor.foreground": "#d4d4d4",
          "editor.lineHighlightBackground": "#2a2a2a",
          "editorLineNumber.foreground": "#858585",
          "editor.selectionBackground": "#264f78",
          "editor.inactiveSelectionBackground": "#3a3d41",
        },
      });
    } catch (error) {
      console.error("Failed to configure Monaco editor theme:", error);
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorInstanceRef.current = editor;
    setIsEditorReady(true);
    try {
      setTimeout(() => editor?.layout(), 100);
      editor.focus();
      editor.setScrollTop(0);
      editor.setScrollLeft(0);
    } catch (error) {
      console.error("Editor mount error:", error);
      setEditorError(String(error));
      setTimeout(() => setLoadFailed(true), 500);
    }
  };

  useEffect(() => {
    setEditorError(null);
    setLoadFailed(false);
    setTimeout(() => editorInstanceRef.current?.layout(), 50);
  }, [content, path]);

  if (loadFailed) {
    return (
      <div className="monaco-error-fallback">
        <h3>Editor failed to load</h3>
        <p>Could not initialize code editor for {path}</p>
        <button onClick={() => setLoadFailed(false)}>Try Again</button>
        <hr />
        <pre className="fallback-content">{content}</pre>
      </div>
    );
  }

  return (
    <>
      {editorError ? (
        <div className="loading-content error">
          <p>Error loading editor: {editorError}</p>
          <button onClick={() => setEditorError(null)}>Retry</button>
          <hr />
          <pre className="fallback-content">{content}</pre>
        </div>
      ) : (
        <div style={{ height: "100%", width: "100%", overflow: "hidden" }}>
          <Editor
            key={path}
            height="100%"
            width="100%"
            defaultLanguage={language}
            value={content}
            theme="triage-dark"
            loading={<div className="loading-content">Loading editor...</div>}
            beforeMount={handleEditorBeforeMount}
            onMount={handleEditorDidMount}
            options={{
              readOnly: true,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: false,
              fontSize: 13,
              fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
              renderLineHighlight: "all",
              lineNumbers: "on",
              guides: {
                indentation: true,
              },
              colorDecorators: true,
              fixedOverflowWidgets: true,
              wordWrap: "off",
            }}
          />
        </div>
      )}
    </>
  );
};

interface CodeViewProps {
  selectedArtifact?: Artifact | null;
}

const CodeView: React.FC<CodeViewProps> = ({ selectedArtifact }) => {
  const codeState = useCode();
  const [initError, setInitError] = useState<string | null>(null);
  const [configRepoPath, setConfigRepoPath] = useState<string>("");

  // Fetch agent config on initial load to get the repo path
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await api.getAgentConfig();
        if (config && config.repoPath) {
          setConfigRepoPath(config.repoPath);
        }
      } catch (error) {
        console.error("Failed to fetch agent config:", error);
      }
    };

    fetchConfig();
  }, []);

  const styles = {
    fileTreeContainer: {
      flex: "0 0 250px",
      overflow: "auto",
      height: "100%",
      borderRight: "1px solid #333",
      backgroundColor: "#1e1e1e",
    },
    codeContent: {
      flex: 1,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column" as const,
      height: "100%",
      minWidth: "300px",
      backgroundColor: "#1e1e1e",
    },
    repoExplorer: {
      display: "flex",
      height: "calc(100vh - 60px)",
      width: "100%",
      overflow: "hidden",
      position: "relative" as const,
    },
    codeHeader: {
      padding: "5px 10px",
      borderBottom: "1px solid #333",
      backgroundColor: "#252526",
      color: "#cccccc",
      fontSize: "13px",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      minHeight: "30px",
      display: "flex",
      alignItems: "center",
    },
    loadingPlaceholder: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100%",
      color: "#888",
      fontSize: "14px",
    },
    errorPlaceholder: {
      padding: "20px",
      color: "#f88",
    },
  };

  useEffect(() => {
    if (selectedArtifact?.type === "code" && selectedArtifact.data) {
      try {
        const codeData = selectedArtifact.data as EnhancedCodeMap;

        // Use the utility function to get file information
        const { repoPath, filePath } = getFileInfoFromArtifact(codeData, configRepoPath);

        if (!repoPath) {
          console.error("No repository path available");
          setInitError("No repository path available");
          return;
        }

        console.info("Code artifact clicked:", {
          repoPath,
          filePath,
          codeDataSize: codeData.size,
        });

        // Load repository if needed
        if (repoPath !== codeState.repoPath || !codeState.rootDir) {
          console.info("Loading repository from artifact:", repoPath);
          codeState
            .fetchFileTree(repoPath)
            .then(() => {
              // After repository is loaded, try to open the file if we have one
              if (filePath && codeState.rootDir) {
                const file = findFileByPath(codeState.rootDir, filePath);
                if (file) {
                  console.info("Opening file from artifact:", filePath);
                  codeState.fetchFileContent(repoPath, file);
                } else {
                  console.warn("File specified in artifact not found:", filePath);
                }
              }
            })
            .catch((error) => {
              console.error("Failed to load repository from artifact:", error);
              setInitError(`Failed to load repository: ${String(error)}`);
            });
        } else if (filePath && codeState.rootDir) {
          // Repository already loaded, try to open the file
          const file = findFileByPath(codeState.rootDir, filePath);
          if (file) {
            console.info("Opening file from artifact:", filePath);
            codeState.fetchFileContent(repoPath, file);
          } else {
            console.warn("File specified in artifact not found:", filePath);
          }
        }
      } catch (error) {
        console.error("Error processing code artifact:", error);
        setInitError(`Error loading from artifact: ${String(error)}`);
      }
    } else if (
      !selectedArtifact &&
      !codeState.rootDir &&
      !codeState.isLoading &&
      !codeState.error &&
      configRepoPath
    ) {
      console.info("No artifact, loading repository from config:", configRepoPath);
      codeState.fetchFileTree(configRepoPath).catch((error) => {
        console.error("Failed to load repository from config:", error);
        setInitError(`Failed to load repository: ${String(error)}`);
      });
    }
  }, [
    selectedArtifact,
    codeState.fetchFileTree,
    codeState.repoPath,
    codeState.rootDir,
    codeState.isLoading,
    codeState.error,
    configRepoPath,
    codeState.fetchFileContent,
  ]);

  useEffect(() => {
    if (
      DEFAULT_FILE_TO_OPEN &&
      codeState.rootDir &&
      !codeState.selectedFile &&
      !codeState.isLoading &&
      codeState.repoPath
    ) {
      const defaultFile = findFileByPath(codeState.rootDir, DEFAULT_FILE_TO_OPEN);
      if (defaultFile) {
        console.info("Loading default file:", DEFAULT_FILE_TO_OPEN);
        codeState.fetchFileContent(codeState.repoPath, defaultFile);
      } else {
        console.warn("Default file not found:", DEFAULT_FILE_TO_OPEN);
      }
    }
  }, [
    codeState.rootDir,
    codeState.isLoading,
    codeState.selectedFile,
    codeState.repoPath,
    codeState.fetchFileContent,
  ]);

  const handleFileSelect = useCallback(
    (file: File) => {
      if (codeState.repoPath && file) {
        if (!codeState.selectedFile || file.id !== codeState.selectedFile.id) {
          codeState.fetchFileContent(codeState.repoPath, file);
        }
      }
    },
    [codeState.repoPath, codeState.fetchFileContent, codeState.selectedFile]
  );

  const renderContent = () => {
    if (initError) {
      return (
        <div className="code-placeholder error" style={styles.errorPlaceholder}>
          <p>{initError}</p>
          <button
            onClick={() => {
              setInitError(null);
              codeState.fetchFileTree(codeState.repoPath || configRepoPath);
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    if (codeState.error && !codeState.isLoading) {
      return (
        <div className="repo-error" style={styles.errorPlaceholder}>
          <p>Error:</p>
          <p>{codeState.error}</p>
          <button
            onClick={() => {
              codeState.fetchFileTree(codeState.repoPath || configRepoPath);
            }}
          >
            Retry Loading Tree
          </button>
        </div>
      );
    }

    if (codeState.isLoading && !codeState.rootDir) {
      return <div style={styles.loadingPlaceholder}>Loading repository structure...</div>;
    }

    if (codeState.rootDir) {
      return (
        <div className="repo-code-explorer" style={styles.repoExplorer}>
          <div className="file-browser" style={styles.fileTreeContainer}>
            <FileTree
              rootDir={codeState.rootDir}
              selectedFile={codeState.selectedFile}
              onSelect={handleFileSelect}
            />
          </div>

          <div className="code-content" style={styles.codeContent}>
            {codeState.selectedFile ? (
              <>
                <div className="code-header" style={styles.codeHeader}>
                  <span>{codeState.selectedFile.id}</span>
                </div>
                {codeState.isLoading && !codeState.fileContent ? (
                  <div style={styles.loadingPlaceholder}>Loading file content...</div>
                ) : (
                  <SafeMonacoEditor
                    key={codeState.selectedFile.id}
                    language={codeState.getLanguageFromFilename(codeState.selectedFile.name)}
                    content={codeState.fileContent}
                    path={codeState.selectedFile.id}
                  />
                )}
              </>
            ) : (
              <div className="no-file-selected" style={styles.loadingPlaceholder}>
                {codeState.isLoading ? "Loading..." : "Select a file to view its contents."}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (!selectedArtifact && !codeState.isLoading && !codeState.error) {
      return <div style={styles.loadingPlaceholder}>Initializing repository view...</div>;
    }

    if (selectedArtifact && selectedArtifact.type !== "code") {
      return (
        <div className="code-placeholder" style={styles.loadingPlaceholder}>
          <p>Selected artifact is not code.</p>
        </div>
      );
    }

    return <div style={styles.loadingPlaceholder}>Waiting for data...</div>;
  };

  return (
    <div className="code-view" style={{ height: "100%", overflow: "hidden" }}>
      <ErrorBoundary>{renderContent()}</ErrorBoundary>
    </div>
  );
};

export default CodeView;
