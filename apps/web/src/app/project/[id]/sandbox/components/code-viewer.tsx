"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface CodeViewerProps {
  content: string;
  filename: string;
  className?: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  scss: "css",
  html: "html",
  md: "markdown",
  py: "python",
  rs: "rust",
  go: "go",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
};

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_MAP[ext] ?? "text";
}

// Simple syntax highlighting for common patterns
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function highlightLine(line: string, language: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // Keywords for various languages
  const keywords = new Set([
    "import",
    "export",
    "from",
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "class",
    "interface",
    "type",
    "async",
    "await",
    "try",
    "catch",
    "throw",
    "new",
    "this",
    "super",
    "extends",
    "implements",
    "public",
    "private",
    "protected",
    "static",
    "readonly",
    "default",
    "null",
    "undefined",
    "true",
    "false",
  ]);

  // Match patterns
  const patterns = [
    // Comments
    { regex: /^(\/\/.*)/, className: "text-green-600" },
    { regex: /^(\/\*[\s\S]*?\*\/)/, className: "text-green-600" },
    // Strings
    { regex: /^("[^"]*")/, className: "text-amber-600" },
    { regex: /^('[^']*')/, className: "text-amber-600" },
    { regex: /^(`[^`]*`)/, className: "text-amber-600" },
    // Numbers
    { regex: /^(\b\d+\.?\d*\b)/, className: "text-purple-600" },
  ];

  while (remaining.length > 0) {
    let matched = false;

    // Try each pattern
    for (const { regex, className } of patterns) {
      const match = remaining.match(regex);
      if (match) {
        result.push(
          <span key={key++} className={className}>
            {match[1]}
          </span>
        );
        remaining = remaining.slice(match[1].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Try to match a word (for keywords)
      const wordMatch = remaining.match(/^(\w+)/);
      if (wordMatch) {
        const word = wordMatch[1];
        if (keywords.has(word)) {
          result.push(
            <span key={key++} className="text-blue-600 font-medium">
              {word}
            </span>
          );
        } else {
          result.push(<span key={key++}>{word}</span>);
        }
        remaining = remaining.slice(word.length);
      } else {
        // Just add the next character
        result.push(<span key={key++}>{remaining[0]}</span>);
        remaining = remaining.slice(1);
      }
    }
  }

  return result;
}

export function CodeViewer({ content, filename, className }: CodeViewerProps) {
  const language = useMemo(
    () => getLanguageFromFilename(filename),
    [filename]
  );

  const lines = useMemo(() => content.split("\n"), [content]);

  const lineNumberWidth = useMemo(
    () => Math.max(2, String(lines.length).length),
    [lines.length]
  );

  return (
    <div
      className={cn(
        "h-full overflow-auto bg-slate-950 text-slate-50 font-mono text-sm",
        className
      )}
    >
      <div className="p-4">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-slate-900">
                <td
                  className="select-none text-right pr-4 text-slate-500"
                  style={{ width: `${lineNumberWidth + 2}ch` }}
                >
                  {i + 1}
                </td>
                <td className="whitespace-pre">
                  {highlightLine(line, language)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
