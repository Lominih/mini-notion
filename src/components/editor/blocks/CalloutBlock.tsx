"use client";

import { useState, useCallback } from "react";

type CalloutType = "info" | "warning" | "error" | "success" | "note";

interface CalloutConfig {
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
  iconClass: string;
}

const CALLOUT_CONFIGS: Record<CalloutType, CalloutConfig> = {
  info: {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    bgClass: "bg-blue-50",
    borderClass: "border-blue-200",
    iconClass: "text-blue-600",
  },
  warning: {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    bgClass: "bg-yellow-50",
    borderClass: "border-yellow-200",
    iconClass: "text-yellow-600",
  },
  error: {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    bgClass: "bg-red-50",
    borderClass: "border-red-200",
    iconClass: "text-red-600",
  },
  success: {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    bgClass: "bg-green-50",
    borderClass: "border-green-200",
    iconClass: "text-green-600",
  },
  note: {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    bgClass: "bg-purple-50",
    borderClass: "border-purple-200",
    iconClass: "text-purple-600",
  },
};

const CALLOUT_TYPES: CalloutType[] = ["info", "warning", "error", "success", "note"];

interface CalloutBlockProps {
  type?: CalloutType;
  content: string;
  onTypeChange?: (type: CalloutType) => void;
  onContentChange?: (content: string) => void;
  onRemove?: () => void;
  readOnly?: boolean;
}

export function CalloutBlock({
  type = "info",
  content,
  onTypeChange,
  onContentChange,
  onRemove,
  readOnly = false,
}: CalloutBlockProps) {
  const [showTypePicker, setShowTypePicker] = useState(false);
  const config = CALLOUT_CONFIGS[type];

  const handleTypeSelect = useCallback(
    (newType: CalloutType) => {
      onTypeChange?.(newType);
      setShowTypePicker(false);
    },
    [onTypeChange],
  );

  return (
    <div
      className={`callout-block relative my-3 flex items-start gap-3 rounded-lg border p-3 ${config.bgClass} ${config.borderClass}`}
    >
      {/* Icon */}
      <button
        onClick={() => !readOnly && setShowTypePicker(!showTypePicker)}
        className={`flex-shrink-0 rounded p-0.5 ${config.iconClass} ${
          readOnly ? "" : "cursor-pointer hover:bg-black/5"
        }`}
        title="Change callout type"
      >
        {config.icon}
      </button>

      {/* Type picker */}
      {showTypePicker && (
        <div className="absolute left-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
          {CALLOUT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => handleTypeSelect(t)}
              className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm capitalize transition-colors ${
                t === type ? "bg-gray-100" : "hover:bg-gray-50"
              } ${CALLOUT_CONFIGS[t].iconClass}`}
            >
              <span className="h-3 w-3">{CALLOUT_CONFIGS[t].icon}</span>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        {readOnly ? (
          <p className="text-sm text-gray-800">{content}</p>
        ) : (
          <textarea
            value={content}
            onChange={(e) => onContentChange?.(e.target.value)}
            placeholder="Type something..."
            className="w-full resize-none border-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
            rows={Math.max(1, content.split("\n").length)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onContentChange?.(content + "\n");
              }
            }}
          />
        )}
      </div>

      {/* Remove button */}
      {!readOnly && (
        <button
          onClick={onRemove}
          className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600 group-hover:flex"
          title="Remove callout"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}