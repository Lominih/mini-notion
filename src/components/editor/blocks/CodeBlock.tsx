"use client";

import { useState, useRef } from "react";

const LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "html",
  "css",
  "sql",
  "json",
  "yaml",
  "bash",
  "shell",
  "markdown",
  "plaintext",
];

interface CodeBlockProps {
  language?: string;
  code: string;
  onChange?: (code: string) => void;
  onLanguageChange?: (lang: string) => void;
  readOnly?: boolean;
}

export function CodeBlock({
  language = "plaintext",
  code,
  onChange,
  onLanguageChange,
  readOnly = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange?.(newValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="code-block group relative my-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-1.5">
        {!readOnly && onLanguageChange ? (
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="cursor-pointer rounded bg-transparent text-xs text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-600"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-gray-400">{language}</span>
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
          title="Copy code"
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code area */}
      <div className="relative p-4">
        <pre className="overflow-x-auto font-mono text-sm leading-relaxed text-gray-100">
          <code>{code}</code>
        </pre>
        {!readOnly && (
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-transparent caret-white focus:outline-none"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
          />
        )}
      </div>
    </div>
  );
}