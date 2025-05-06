import { ReactNode } from "react";
import {
  FaFile, // Default file icon
  FaFolder, // Closed folder
  FaFolderOpen, // Open folder
  FaJava,
  FaMarkdown,
  FaNodeJs,
  FaPhp,
  FaReact,
  FaRust,
  FaSwift,
  FaTerminal, // Shell scripts
  FaVuejs,
} from "react-icons/fa";
import { SiCss3, SiHtml5, SiJson, SiPython, SiTypescript } from "react-icons/si";

/**
 * Caches icon components for file extensions and names.
 * Improves performance by avoiding re-creation of icons.
 */
function getIconHelper() {
  const cache = new Map<string, ReactNode>();

  // File extension mappings (lowercase)
  cache.set("js", <FaNodeJs color="#8cc84b" />); // Node.js green for JS
  cache.set("jsx", <FaReact color="#61dafb" />); // React blue for JSX
  cache.set("ts", <SiTypescript color="#3178C6" />); // TypeScript blue
  cache.set("tsx", <FaReact color="#61dafb" />); // React blue for TSX
  cache.set("html", <SiHtml5 color="#E34F26" />); // HTML orange
  cache.set("css", <SiCss3 color="#1572B6" />); // CSS blue
  cache.set("scss", <SiCss3 color="#CD6799" />); // SCSS pink
  cache.set("less", <SiCss3 color="#1d365d" />); // LESS dark blue
  cache.set("json", <SiJson color="#F5A623" />); // JSON orange
  cache.set("md", <FaMarkdown color="#083fa1" />); // Markdown blue
  cache.set("py", <SiPython color="#3776AB" />); // Python blue
  cache.set("java", <FaJava color="#ED8B00" />); // Java orange
  cache.set("go", <FaFile color="#00ADD8" />); // Go blue - using generic file with Go color
  cache.set("php", <FaPhp color="#777BB4" />); // PHP purple
  cache.set("rb", <FaFile color="#CC342D" />); // Ruby red (generic)
  cache.set("c", <FaFile color="#A8B9CC" />); // C grey (generic)
  cache.set("cpp", <FaFile color="#649ad2" />); // C++ blue (generic)
  cache.set("cs", <FaFile color="#9b4f96" />); // C# purple (generic)
  cache.set("rs", <FaRust color="#dea584" />); // Rust color
  cache.set("swift", <FaSwift color="#ffac45" />); // Swift orange
  cache.set("sh", <FaTerminal color="#4EAA25" />); // Shell green
  cache.set("bash", <FaTerminal color="#4EAA25" />); // Shell green
  cache.set("yml", <FaFile color="#cb171e" />); // YAML red (generic)
  cache.set("yaml", <FaFile color="#cb171e" />); // YAML red (generic)
  cache.set("xml", <FaFile color="#ff6600" />); // XML orange (generic)
  cache.set("sql", <FaFile color="#00758f" />); // SQL blue (generic)
  cache.set("vue", <FaVuejs color="#4fc08d" />); // Vue green

  // Specific file name mappings (case-insensitive)
  cache.set("dockerfile", <FaFile color="#384d54" />); // Docker blue-grey
  cache.set(".gitignore", <FaFile color="#F05032" />); // Git orange
  cache.set("license", <FaFile color="#ffd700" />); // Gold for license
  cache.set("readme.md", <FaMarkdown color="#083fa1" />); // Specific Readme

  // Directory icons
  cache.set("closedDirectory", <FaFolder color="#ffd04b" />); // Folder yellow
  cache.set("openDirectory", <FaFolderOpen color="#ffd04b" />); // Folder yellow

  /**
   * Retrieves the appropriate icon for a file or directory.
   * Checks cache based on extension, then name.
   * @param extension The file extension (lowercase).
   * @param name The specific name of the item (lowercase).
   * @returns A ReactNode representing the icon, or a default icon.
   */
  return function (extension: string, name: string): ReactNode {
    const lowerExt = extension.toLowerCase();
    const lowerName = name.toLowerCase();

    if (cache.has(lowerExt)) {
      return cache.get(lowerExt);
    }
    if (cache.has(lowerName)) {
      return cache.get(lowerName);
    }
    // Default icon if no match found
    return <FaFile color="#6e6e6e" />;
  };
}

export const getIcon = getIconHelper();
