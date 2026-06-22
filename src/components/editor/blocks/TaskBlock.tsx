"use client";

import { useState, useCallback } from "react";

interface TaskBlockProps {
  text: string;
  checked?: boolean;
  onTextChange?: (text: string) => void;
  onCheckedChange?: (checked: boolean) => void;
  onRemove?: () => void;
  readOnly?: boolean;
  nested?: boolean;
  level?: number;
}

export function TaskBlock({
  text,
  checked = false,
  onTextChange,
  onCheckedChange,
  onRemove,
  readOnly = false,
  nested = false,
  level = 0,
}: TaskBlockProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onTextChange?.("");
      }
      if (e.key === "Backspace" && text === "" && onRemove) {
        e.preventDefault();
        onRemove();
      }
    },
    [text, onTextChange, onRemove],
  );

  return (
    <div
      className={`task-block group flex items-start gap-2 rounded py-0.5 transition-colors ${
        isFocused ? "bg-gray-50" : ""
      }`}
      style={{ marginLeft: `${level * 1.5}rem` }}
    >
      {/* Checkbox */}
      <label className="flex-shrink-0 pt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          disabled={readOnly}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </label>

      {/* Text */}
      {readOnly ? (
        <span
          className={`flex-1 text-sm ${
            checked ? "text-gray-400 line-through" : "text-gray-900"
          }`}
        >
          {text}
        </span>
      ) : (
        <input
          type="text"
          value={text}
          onChange={(e) => onTextChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Task..."
          className={`flex-1 border-none bg-transparent text-sm placeholder:text-gray-400 focus:outline-none ${
            checked ? "text-gray-400 line-through" : "text-gray-900"
          }`}
        />
      )}

      {/* Remove button */}
      {!readOnly && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
          title="Remove task"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}