// @ts-ignore - Ignoring React module resolution issues
import React from "react";
import { ScrollArea } from "./ui/scroll-area";

interface FactsSidebarProps {
  facts: { title: string; content: string }[];
  toggleFactsSidebar: () => void;
}

const FactsSidebar: React.FC<FactsSidebarProps> = ({ facts, toggleFactsSidebar }) => {
  // Simplified version for the refactored design

  return (
    <div className="w-72 h-full bg-background-sidebar border-l border-border flex flex-col">
      <div className="p-3 border-b border-border flex justify-between items-center">
        <h2 className="font-medium">Facts</h2>
        <button
          onClick={toggleFactsSidebar}
          className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
        >
          ×
        </button>
      </div>
      <ScrollArea className="h-full">
        <div className="p-3 space-y-3">
          {facts.map((fact, index) => (
            <div key={index} className="p-3 rounded-lg bg-background-lighter border border-border">
              <h3 className="font-medium text-sm mb-2">{fact.title}</h3>
              <p className="text-sm text-gray-300">{fact.content}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FactsSidebar;
