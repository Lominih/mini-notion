"use client";

import { useState, useCallback } from "react";
import { BubbleMenu } from "@tiptap/react";
import type { Editor } from "@tiptap/react";

interface EditorBubbleMenuProps {
  editor: Editor;
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const setLink = useCallback(() => {
    if (!linkUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl })
        .run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 100,
        placement: "top",
      }}
      shouldShow={({ editor, state }) => {
        if (editor.isActive("image") || editor.isActive("codeBlock")) return false;
        const { from, to } = state.selection;
        return from !== to;
      }}
      className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-1 py-0.5 shadow-lg"
    >
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`rounded px-2 py-1 text-sm font-bold transition-colors
          ${editor.isActive("bold") ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100"}`}
        title="Bold"
      >
        B
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`rounded px-2 py-1 text-sm italic transition-colors
          ${editor.isActive("italic") ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100"}`}
        title="Italic"
      >
        I
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`rounded px-2 py-1 text-sm line-through transition-colors
          ${editor.isActive("strike") ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100"}`}
        title="Strikethrough"
      >
        S
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`rounded px-2 py-1 text-sm font-mono transition-colors
          ${editor.isActive("code") ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100"}`}
        title="Inline Code"
      >
        {"</>"}
      </button>

      <div className="mx-0.5 h-4 w-px bg-gray-300" />

      <button
        onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
        className={`rounded px-2 py-1 text-sm transition-colors
          ${editor.isActive("highlight") ? "bg-yellow-200 text-gray-900" : "text-gray-700 hover:bg-gray-100"}`}
        title="Highlight"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.243 2.69l2.122 2.121-9.193 9.193-4.243.707.707-4.243 9.193-9.193zM6.343 17.657a2 2 0 0 1-.707.707l-3.536 1.414 1.414-3.536a2 2 0 0 1 .707-.707l2.121 2.121z" />
        </svg>
      </button>

      <div className="mx-0.5 h-4 w-px bg-gray-300" />

      {!showLinkInput ? (
        <button
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
            } else {
              setShowLinkInput(true);
            }
          }}
          className={`rounded px-2 py-1 text-sm transition-colors
            ${editor.isActive("link") ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100"}`}
          title="Link"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setLink();
              if (e.key === "Escape") setShowLinkInput(false);
            }}
            placeholder="https://..."
            className="w-36 rounded border border-gray-300 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
            autoFocus
          />
          <button
            onClick={setLink}
            className="rounded bg-blue-500 px-1.5 py-0.5 text-xs text-white hover:bg-blue-600"
          >
            Set
          </button>
        </div>
      )}
    </BubbleMenu>
  );
}