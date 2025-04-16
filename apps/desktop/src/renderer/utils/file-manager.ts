import { FileTreeNode } from "../types";

export enum Type {
  FILE,
  DIRECTORY,
  DUMMY,
}

// Base interface for common properties
interface CommonProps {
  id: string; // Use path as unique ID
  type: Type;
  name: string;
  parentId: string | undefined;
  depth: number;
}

// Interface for File nodes
export interface File extends CommonProps {
  type: Type.FILE;
  content?: string; // Content can be loaded separately
}

// Interface for Directory nodes
export interface Directory extends CommonProps {
  type: Type.DIRECTORY;
  files: File[];
  dirs: Directory[];
}

// Type guard for File
export function isFile(node: File | Directory): node is File {
  return node.type === Type.FILE;
}

// Type guard for Directory
export function isDirectory(node: File | Directory): node is Directory {
  return node.type === Type.DIRECTORY;
}

/**
 * Builds a nested file tree structure from the flat FileTreeNode list.
 * Adapts the logic from the user-provided example to work with FileTreeNode.
 * @param nodes The flat list of FileTreeNode objects from the API.
 * @returns The root Directory node.
 */
export function buildFileTree(nodes: FileTreeNode[]): Directory {
  // Create the root directory object
  const rootDir: Directory = {
    id: "root", // Special ID for the root
    name: "root",
    parentId: undefined,
    type: Type.DIRECTORY,
    depth: 0,
    dirs: [],
    files: [],
  };

  // NEW APPROACH: Handle nested structure returned by backend
  function processNode(node: FileTreeNode, parentDir: Directory, depth: number): void {
    if (node.isDirectory) {
      // Create directory object
      const dir: Directory = {
        id: node.path,
        name: node.name,
        parentId: parentDir.id,
        type: Type.DIRECTORY,
        depth: depth,
        dirs: [],
        files: [],
      };

      // Add directory to parent's dirs
      parentDir.dirs.push(dir);

      // Process children if they exist
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child) => {
          processNode(child, dir, depth + 1);
        });
      }
    } else {
      // Create file object
      const file: File = {
        id: node.path,
        name: node.name,
        parentId: parentDir.id,
        type: Type.FILE,
        depth: depth,
      };

      // Add file to parent's files
      parentDir.files.push(file);
    }
  }

  // Process all top-level nodes
  if (Array.isArray(nodes)) {
    nodes.forEach((node) => {
      processNode(node, rootDir, 1);
    });
  }

  return rootDir;
}

/**
 * Recursively calculates the depth of each node in the tree.
 * @param dir The current directory node.
 * @param currentDepth The depth of the current directory.
 */
function getDepth(dir: Directory, currentDepth: number) {
  dir.depth = currentDepth; // Set depth for the directory itself

  dir.files.forEach((file) => {
    file.depth = currentDepth + 1;
  });
  dir.dirs.forEach((subDir) => {
    subDir.depth = currentDepth + 1;
    getDepth(subDir, currentDepth + 1); // Recurse into subdirectories
  });
}

/**
 * Finds a file by its name (path) within the directory tree.
 * @param rootDir The root directory to start searching from.
 * @param filePath The full path of the file to find.
 * @returns The File object if found, otherwise undefined.
 */
export function findFileByPath(rootDir: Directory, filePath: string): File | undefined {
  let targetFile: File | undefined = undefined;

  function find(dir: Directory) {
    // Check files in the current directory
    const foundFile = dir.files.find((file) => file.id === filePath);
    if (foundFile) {
      targetFile = foundFile;
      return; // Stop searching if found
    }

    // Recursively search in subdirectories if not found yet
    if (!targetFile) {
      for (const subDir of dir.dirs) {
        find(subDir);
        if (targetFile) return; // Stop if found in subdirectory
      }
    }
  }

  find(rootDir);
  return targetFile;
}

// Sorting function for directories by name
export function sortDir(a: Directory, b: Directory): number {
  return a.name.localeCompare(b.name);
}

// Sorting function for files by name
export function sortFile(a: File, b: File): number {
  return a.name.localeCompare(b.name);
}
