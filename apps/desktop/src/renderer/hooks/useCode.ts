import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { FileTreeNode } from "../types";
import { buildFileTree, Directory, File, Type } from "../utils/file-manager";

// Default directory structure while loading or if error occurs
const defaultRootDir: Directory = {
  id: "root",
  name: "root",
  parentId: undefined,
  type: Type.DIRECTORY,
  depth: 0,
  dirs: [],
  files: [],
};

export function useCode() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Change fileTree state to hold the root Directory object
  const [rootDir, setRootDir] = useState<Directory | null>(null);
  // Change selectedFile state to hold the File object
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const [fileContent, setFileContent] = useState<string>("");
  const [repoPath, setRepoPath] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  // Memoized function to fetch file content
  const fetchFileContent = useCallback(
    async (repoPath: string, file: File): Promise<void> => {
      const now = Date.now();
      // Prevent rapid refetching of the same file
      if (
        isLoading ||
        (selectedFile && file.id === selectedFile.id && now - lastFetchTime < 1000)
      ) {
        console.info(`Skipping duplicate fetch for ${file.id}`);
        return;
      }

      setLastFetchTime(now);
      setIsLoading(true);
      setError(null);
      // Optimistically set selected file
      setSelectedFile(file);

      try {
        console.info(`Fetching content for ${file.id}`);
        const response = await api.getFileContent(repoPath, file.id); // file.id is the path

        if (response && response.success && typeof response.data === "string") {
          setFileContent(response.data);
        } else {
          const errorMsg = response?.error || "Invalid response format";
          console.warn(`Failed to load file content for ${file.id}:`, errorMsg);
          setError(`Failed to load content: ${errorMsg}`);
          setFileContent(""); // Clear content on error
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error fetching file content for ${file.id}:`, errorMsg);
        setError(`Error loading file: ${errorMsg}`);
        setFileContent(""); // Clear content on error
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, selectedFile, lastFetchTime] // Dependencies
  );

  // Memoized function to fetch the file tree structure
  const fetchFileTree = useCallback(
    async (path: string): Promise<void> => {
      const now = Date.now();
      if (isLoading || (path === repoPath && now - lastFetchTime < 1500)) {
        console.info(`Skipping duplicate file tree fetch for ${path}`);
        return;
      }

      setLastFetchTime(now);
      setIsLoading(true);
      setError(null);
      setRepoPath(path);
      setRootDir(null); // Set to null while loading
      setSelectedFile(undefined);
      setFileContent("");

      try {
        console.info(`Fetching file tree for ${path}`);
        const response = await api.getFileTree(path);

        if (response && response.success && Array.isArray(response.data)) {
          const builtTree = buildFileTree(response.data as FileTreeNode[]);
          setRootDir(builtTree);
        } else {
          const errorMsg = response?.error || "Invalid response format";
          console.warn(`Failed to load file tree for ${path}:`, errorMsg);
          setError(`Failed to load file tree: ${errorMsg}`);
          setRootDir(defaultRootDir); // Set to default empty dir on error
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error fetching file tree for ${path}:`, errorMsg);
        setError(`Error loading file tree: ${errorMsg}`);
        setRootDir(defaultRootDir); // Set to default empty dir on error
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, repoPath, lastFetchTime]
  ); // Dependencies

  // Initial fetch of repo path from config and then the file tree
  useEffect(() => {
    let isMounted = true; // Track mount status
    const fetchConfigAndTree = async () => {
      try {
        const config = await api.getAgentConfig();
        if (isMounted && config && config.repoPath) {
          await fetchFileTree(config.repoPath);
        }
      } catch (err) {
        if (isMounted) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error("Error fetching initial agent config:", errorMsg);
          setError(`Error loading configuration: ${errorMsg}`);
          setRootDir(defaultRootDir);
        }
      }
    };

    fetchConfigAndTree();

    return () => {
      isMounted = false;
    }; // Cleanup on unmount
  }, [fetchFileTree]); // Depend on fetchFileTree

  // Get language identifier for Monaco from filename
  const getLanguageFromFilename = (filename?: string): string => {
    if (!filename) return "plaintext";
    const extension = filename.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "js":
        return "javascript";
      case "ts":
        return "typescript";
      case "tsx":
        return "typescript";
      case "jsx":
        return "javascript";
      case "json":
        return "json";
      case "html":
        return "html";
      case "css":
        return "css";
      case "scss":
        return "scss";
      case "less":
        return "less";
      case "md":
        return "markdown";
      case "py":
        return "python";
      case "java":
        return "java";
      case "go":
        return "go";
      case "rb":
        return "ruby";
      case "php":
        return "php";
      case "c":
        return "c";
      case "cpp":
      case "cc":
      case "h":
      case "hpp":
        return "cpp";
      case "rs":
        return "rust";
      case "swift":
        return "swift";
      case "sh":
      case "bash":
        return "shell";
      case "yml":
      case "yaml":
        return "yaml";
      case "xml":
        return "xml";
      case "sql":
        return "sql";
      default:
        return "plaintext";
    }
  };

  return {
    isLoading,
    rootDir, // Use rootDir instead of fileTree
    selectedFile,
    fileContent,
    repoPath,
    error,
    fetchFileTree,
    fetchFileContent,
    setSelectedFile, // Expose setter if needed externally (e.g., for default file)
    getLanguageFromFilename,
    // Removed expandedNodes, toggleNodeExpansion, setExpandedNodes
  };
}
