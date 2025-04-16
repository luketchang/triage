import styled from "@emotion/styled";
import React from "react";
import { FaFolder, FaFolderOpen } from "react-icons/fa";
import { Directory, File, sortDir, sortFile } from "../utils/file-manager";
import { getIcon } from "../utils/icon";

// --- Component Props Interfaces ---

interface FileTreeProps {
  rootDir: Directory | null; // Root directory, potentially null while loading
  selectedFile: File | undefined; // Currently selected file
  onSelect: (file: File) => void; // Callback when a file is selected
}

interface SubTreeProps {
  directory: Directory;
  selectedFile: File | undefined;
  onSelect: (file: File) => void;
}

interface FileDivProps {
  file: File;
  selectedFile: File | undefined;
  onClick: () => void;
}

interface DirDivProps {
  directory: Directory;
  selectedFile: File | undefined;
  onSelect: (file: File) => void;
}

// --- Styled Components ---

const TreeWrapper = styled.div`
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  font-size: 14px;
  color: #d4d4d4; // Light grey text for better contrast on dark bg
  background-color: #1e1e1e; // Dark background similar to VS Code
  padding: 5px;
  height: 100%;
  overflow-y: auto;
  border-right: 1px solid #333; // Add right border

  /* Debug border to ensure the component is rendering properly */
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);

  /* Ensure good scrolling behavior */
  &::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: #424242;
    border-radius: 5px;
  }

  &::-webkit-scrollbar-track {
    background: #1e1e1e;
  }
`;

const BaseItemDiv = styled.div<{
  depth: number;
  isSelected: boolean;
  className?: string;
}>`
  display: flex;
  align-items: center;
  padding: 2px 8px;
  padding-left: ${(props) => props.depth * 16 + 8}px; // Indentation based on depth
  cursor: pointer;
  background-color: ${(props) =>
    props.isSelected ? "#2a2d2e" : "transparent"}; // Subtle selection highlight
  border-radius: 3px;
  margin: 1px 2px;
  min-height: 24px; // Minimum height to ensure good clickable area
  user-select: none; // Prevent text selection on double click

  &:hover {
    background-color: #2a2d2e; // Highlight on hover
  }

  &:active {
    background-color: #3a3d41; // Darker background when clicked
  }
`;

const IconWrapper = styled.span`
  display: inline-flex; // Use inline-flex for better alignment
  align-items: center;
  justify-content: center;
  width: 20px; // Fixed width for icons
  height: 20px; // Fixed height for icons
  margin-right: 5px; // Space between icon and text
`;

const ItemName = styled.span`
  white-space: nowrap; // Prevent text wrapping
  overflow: hidden;
  text-overflow: ellipsis; // Add ellipsis for long names
`;

// --- Utility Functions ---

/**
 * Checks if the currently selected file is a descendant of the given directory.
 * Used to determine if a directory should be open by default.
 */
const isChildSelected = (directory: Directory, selectedFile: File): boolean => {
  // If the file's path starts with the directory's path followed by a slash,
  // then it is a descendant of the directory
  if (selectedFile.id.startsWith(directory.id + "/")) {
    return true;
  }

  // Direct child check (parent ID match)
  if (selectedFile.parentId === directory.id) {
    return true;
  }

  return false;
};

// --- Core Components ---

/**
 * Renders a single file item in the tree.
 */
const FileItem: React.FC<FileDivProps> = ({ file, selectedFile, onClick }) => {
  const isSelected = !!selectedFile && selectedFile.id === file.id;
  const extension = file.name.split(".").pop() || "";

  return (
    <BaseItemDiv depth={file.depth} isSelected={isSelected} onClick={onClick} title={file.id}>
      <IconWrapper>{getIcon(extension, file.name)}</IconWrapper>
      <ItemName>{file.name}</ItemName>
    </BaseItemDiv>
  );
};

/**
 * Component for rendering a directory in the file tree
 */
const DirectoryItem: React.FC<DirDivProps> = ({ directory, selectedFile, onSelect }) => {
  // Track if directory is open
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  // Track if the user has explicitly closed this directory
  const userClosedDir = React.useRef<boolean>(false);
  // Add a ref to track pending state updates
  const pendingStateUpdate = React.useRef<boolean | null>(null);

  // Open directory if it contains the selected file, but ONLY if user hasn't explicitly closed it
  React.useEffect(() => {
    const containsSelectedFile =
      selectedFile &&
      (selectedFile.id.startsWith(directory.id + "/") || selectedFile.parentId === directory.id);

    // Only auto-open if the directory contains the selected file AND the user hasn't manually closed it
    if (containsSelectedFile && !isOpen && !userClosedDir.current) {
      console.log(`Auto-opening directory ${directory.name} because it contains selected file`);
      setIsOpen(true);
    }
  }, [directory, selectedFile, isOpen]);

  // Click handler for the directory itself
  const handleDirectoryClick = React.useCallback(() => {
    // Prevent rapid toggle that could cause "stuck" state
    if (pendingStateUpdate.current !== null) {
      console.log(`Ignoring rapid click on ${directory.name}, toggle already in progress`);
      return;
    }

    const newState = !isOpen;
    console.log(`Directory ${directory.name} clicked, toggling from ${isOpen} to ${newState}`);

    // If we're closing a directory, remember this was a user action
    if (!newState) {
      userClosedDir.current = true;
    } else {
      // If we're opening a directory, reset the flag
      userClosedDir.current = false;
    }

    // Track pending state change
    pendingStateUpdate.current = newState;

    // Debug the directory structure
    console.log(`Directory structure for ${directory.name}:`, {
      id: directory.id,
      dirs: directory.dirs.map((d) => ({ id: d.id, name: d.name })),
      files: directory.files.map((f) => ({ id: f.id, name: f.name })),
    });

    // Toggle state with slight delay to prevent double-triggering
    setIsOpen(newState);

    // Clear pending state flag after a short delay
    setTimeout(() => {
      pendingStateUpdate.current = null;
    }, 100);
  }, [directory, isOpen]);

  // Classes to help with debugging
  const dirClass = `directory-item ${isOpen ? "directory-open" : "directory-closed"}`;

  return (
    <div className="directory-container">
      <BaseItemDiv
        depth={directory.depth}
        isSelected={false}
        className={dirClass}
        onClick={handleDirectoryClick}
      >
        <span style={{ marginRight: "5px", display: "inline-block", width: "16px" }}>
          {isOpen ? <FaFolderOpen /> : <FaFolder />}
        </span>
        {directory.name}
      </BaseItemDiv>
      {isOpen && <SubTree directory={directory} selectedFile={selectedFile} onSelect={onSelect} />}
    </div>
  );
};

/**
 * Renders the contents of a directory (its subdirectories and files).
 */
const SubTree: React.FC<SubTreeProps> = ({ directory, selectedFile, onSelect }) => {
  console.log(
    `SubTree rendering for: ${directory.name}, Dirs: ${directory.dirs.length}, Files: ${directory.files.length}`
  );

  // Additional detailed debugging
  if (directory.dirs.length === 0 && directory.files.length === 0) {
    console.warn(`Directory ${directory.name} (id: ${directory.id}) has no children!`);
    console.log(`Full directory object:`, directory);
  }

  return (
    <>
      {directory.dirs
        .slice() // Create a copy before sorting to avoid mutating the original array
        .sort(sortDir)
        .map((dir) => (
          <DirectoryItem
            key={dir.id}
            directory={dir}
            selectedFile={selectedFile}
            onSelect={onSelect}
          />
        ))}
      {directory.files
        .slice() // Create a copy before sorting
        .sort(sortFile)
        .map((file) => (
          <FileItem
            key={file.id}
            file={file}
            selectedFile={selectedFile}
            onClick={() => onSelect(file)}
          />
        ))}
    </>
  );
};

// Add this right before exporting the FileTree component
// This will help debug the structure once it's mounted
const DebugMessage = () => {
  // Log once after component is mounted
  React.useEffect(() => {
    console.log("FileTree component mounted - folders should now be clickable");
    return () => console.log("FileTree component unmounted");
  }, []);

  return null; // Don't render anything
};

/**
 * The main FileTree component.
 */
export const FileTree: React.FC<FileTreeProps> = ({ rootDir, selectedFile, onSelect }) => {
  if (!rootDir) {
    return <TreeWrapper>Loading files...</TreeWrapper>; // Handle loading state
  }

  return (
    <TreeWrapper>
      <DebugMessage />
      <SubTree directory={rootDir} selectedFile={selectedFile} onSelect={onSelect} />
    </TreeWrapper>
  );
};
