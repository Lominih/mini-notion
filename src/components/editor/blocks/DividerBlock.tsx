"use client";

import { useState } from "react";

type DividerStyle = "solid" | "dashed" | "dotted";

interface DividerBlockProps {
  style?: DividerStyle;
  onStyleChange?: (style: DividerStyle) => void;
  onRemove?: () => void;
  readOnly?: boolean;
}

export function DividerBlock({
  style = "solid",
  onStyleChange,
  onRemove,
  readOnly = false,
}: DividerBlockProps) {
  const [showOptions, setShowOptions] = useState(false);

  const STYLES: { value: DividerStyle; label: string; preview: string }[] = [
    { value: "solid", label: "Solid", preview: "━━━━━━━━━━━━━━━━━━━━━" },
    { value: "dashed", label: "Dashed", preview: "- - - - - - - - - - -" },
    { value: "dotted", label: "Dotted", preview: "· · · · · · · · · · ·" },
  ];

  return (
    <div
      className="divider-block group relative my-4 flex items-center"
      onMouseEnter={() => !readOnly && setShowOptions(true)}
      onMouseLeave={() => !readOnly && setShowOptions(false)}
    >
      <hr
        className="flex-1 border-t border-gray-300"
        style={{ borderStyle: style }}
      />

      {/* Style selector (on hover) */}
      {!readOnly && showOptions && (
        <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-lg">
          {STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => onStyleChange?.(s.value)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                s.value === style
                  ? "bg-gray-200 text-gray-900"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
              title={s.label}
            >
              {s.label}
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-gray-300" />
          <button
            onClick={onRemove}
            className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600"
            title="Remove divider"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}