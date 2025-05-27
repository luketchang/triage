import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "../../lib/utils.js";

/**
 * Custom code block component for syntax highlighting
 */
export const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  return (
    <div className="relative my-3 rounded-lg overflow-hidden w-full">
      <div className="absolute top-0 right-0 px-2 py-1 text-xs bg-background-alt text-gray-400 rounded-bl-md z-10">
        {language}
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          backgroundColor: "#252525", // bg-background-alt
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          lineHeight: 1.6,
          padding: "1.5rem 1rem",
        }}
        wrapLines={true}
        wrapLongLines={true}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

interface MarkdownProps {
  children: string;
  className?: string;
}

interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("max-w-none markdown-trim-margins", className)}>
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }: CodeProps) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <CodeBlock language={match[1]} value={String(children).replace(/\n$/, "")} />
            ) : (
              <code
                className={cn(
                  "bg-background-alt px-1 py-0.5 rounded text-sm font-mono break-all",
                  className
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="my-3 leading-relaxed break-all">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-2xl font-bold mt-6 mb-3 break-all">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-xl font-bold mt-5 mb-2 break-all">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-lg font-bold mt-4 mb-2 break-all">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-base font-bold mt-4 mb-2 break-all">{children}</h4>;
          },
          h5({ children }) {
            return <h5 className="text-sm font-bold mt-3 mb-1 break-all">{children}</h5>;
          },
          h6({ children }) {
            return <h6 className="text-xs font-bold mt-3 mb-1 break-all">{children}</h6>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-6 my-3 space-y-1 break-all">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-6 my-3 space-y-1 break-all">{children}</ol>;
          },
          li({ children }) {
            return <li className="mb-1 break-all">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-primary/50 pl-4 italic text-gray-300 break-all">
                {children}
              </blockquote>
            );
          },
          a({ children, href }) {
            return (
              <a
                href={href}
                className="text-primary-light hover:underline break-all"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
          pre({ children }) {
            return (
              <pre className="my-4 bg-background-alt rounded-lg p-3 text-sm overflow-x-auto w-full break-all">
                {children}
              </pre>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="border-collapse border border-border/60">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-border/60 bg-background-lighter p-2 text-left font-medium break-all">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border border-border/60 p-2 break-all">{children}</td>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
