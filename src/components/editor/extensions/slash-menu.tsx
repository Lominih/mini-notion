"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ReactRenderer } from "@tiptap/react";
import type { Editor, Range } from "@tiptap/react";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";

/* ------------------------------------------------------------------ */
/*  Suggestion items                                                   */
/* ------------------------------------------------------------------ */

export interface SlashMenuItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: Editor; range: Range }) => void;
}

export function getSlashMenuItems(): SlashMenuItem[] {
  return [
    {
      title: "Text",
      description: "Plain text block",
      icon: <span className="text-lg">¶</span>,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
      },
    },
    {
      title: "Heading 1",
      description: "Large section heading",
      icon: <span className="text-base font-bold">H1</span>,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
      },
    },
    {
      title: "Heading 2",
      description: "Medium section heading",
      icon: <span className="text-base font-bold">H2</span>,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
      },
    },
    {
      title: "Heading 3",
      description: "Small section heading",
      icon: <span className="text-base font-bold">H3</span>,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
      },
    },
    {
      title: "Bullet List",
      description: "Unordered bullet list",
      icon: <span className="text-lg">•≡</span>,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "Numbered List",
      description: "Ordered numbered list",
      icon: <span className="text-lg">1.</span>,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "Task List",
      description: "Checkbox task list",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="6" height="6" rx="1" />
          <path d="M5 8l1.5 1.5L9 6" />
          <line x1="13" y1="8" x2="21" y2="8" />
        </svg>
      ),
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "Quote",
      description: "Blockquote",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 8c-1.1 0-2 .9-2 2v4h4v-4H8.5c0-1.38 1.12-2.5 2.5-2.5V5c-2.76 0-5 2.24-5 5v6h6V8h-1zm10 0c-1.1 0-2 .9-2 2v4h4v-4h-1.5c0-1.38 1.12-2.5 2.5-2.5V5c-2.76 0-5 2.24-5 5v6h6V8h-1z" />
        </svg>
      ),
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: "Code Block",
      description: "Syntax highlighted code block",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: "Divider",
      description: "Horizontal divider line",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      ),
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: "Image",
      description: "Insert an image",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      ),
      command: ({ editor, range }) => {
        const url = window.prompt("Enter image URL:");
        if (url) {
          editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
        }
      },
    },
    {
      title: "Table",
      description: "Insert a 3×3 table",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      ),
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  List component                                                     */
/* ------------------------------------------------------------------ */

interface SlashMenuListProps {
  items: SlashMenuItem[];
  command: (item: SlashMenuItem) => void;
}

function SlashMenuList({ items, command }: SlashMenuListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const selected = el.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const item = items[selectedIndex];
        if (item) command(item);
      }
    },
    [items, selectedIndex, command],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-500 shadow-lg">
        No results
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="max-h-72 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      onKeyDown={handleKeyDown}
    >
      {items.map((item, index) => (
        <button
          key={item.title}
          onClick={() => command(item)}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors
            ${index === selectedIndex ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"}`}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-gray-600">
            {item.icon}
          </span>
          <div className="min-w-0">
            <div className="font-medium">{item.title}</div>
            <div className="truncate text-xs text-gray-500">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Suggestion wrapper (renders via tippy)                              */
/* ------------------------------------------------------------------ */

const suggestion = {
  items: ({ query }: { query: string }) => {
    const items = getSlashMenuItems();
    return items
      .filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 10);
  },

  render: () => {
    let component: ReactRenderer | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props: SuggestionProps) => {
        component = new ReactRenderer(SlashMenuList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },

      onUpdate: (props: SuggestionProps) => {
        component?.updateProps(props);
        if (!props.clientRect) return;
        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === "Escape") {
          popup?.[0]?.hide();
          return true;
        }
        return (component?.ref as SlashMenuList | null)?.handleKeyDown
          ? false
          : false;
      },

      onExit: () => {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },

  allowSpaces: true,
};

/* ------------------------------------------------------------------ */
/*  SlashMenu component (tip: mount as React child of BlockEditor)     */
/* ------------------------------------------------------------------ */

export function SlashMenu({ editor }: { editor: Editor }) {
  useEffect(() => {
    if (!editor) return;

    const plugin = editor.extensionManager.extensions.find(
      (e) => e.name === "slashMenu",
    );

    if (!plugin) {
      /* Dynamically register as a ProseMirror plugin via TipTap */
      const { Extension } = require("@tiptap/core");
      const Suggestion = require("@tiptap/suggestion").default;

      const SlashMenuExtension = Extension.create({
        name: "slashMenu",

        addOptions() {
          return {
            suggestion: {
              char: "/",
              command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashMenuItem }) => {
                props.command({ editor, range });
              },
            },
          };
        },

        addProseMirrorPlugins() {
          return [
            Suggestion({
              editor: this.editor,
              ...this.options.suggestion,
            }),
          ];
        },
      });

      editor.registerExtensions([SlashMenuExtension]);
    }
  }, [editor]);

  return null;
}