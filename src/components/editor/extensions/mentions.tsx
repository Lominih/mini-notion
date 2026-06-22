"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Suggestion, type SuggestionProps, type SuggestionKeyDownProps } from "@tiptap/suggestion";
import { useState, useEffect, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface MentionUser {
  id: string;
  name: string;
  avatar?: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                           */
/* ------------------------------------------------------------------ */

const MOCK_USERS: MentionUser[] = [
  { id: "1", name: "Alice Chen" },
  { id: "2", name: "Bob Smith" },
  { id: "3", name: "Carol Davis" },
  { id: "4", name: "Dave Wilson" },
  { id: "5", name: "Eve Martinez" },
];

function filterUsers(query: string): MentionUser[] {
  if (!query) return MOCK_USERS;
  return MOCK_USERS.filter((u) =>
    u.name.toLowerCase().includes(query.toLowerCase()),
  );
}

/* ------------------------------------------------------------------ */
/*  MentionList – dropdown for @ suggestion                             */
/* ------------------------------------------------------------------ */

interface MentionListProps {
  items: MentionUser[];
  command: (item: MentionUser) => void;
}

function MentionList({ items, command }: MentionListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % items.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[selectedIndex];
        if (item) command(item);
      }
    },
    [items, selectedIndex, command],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-500 shadow-lg">
        No users found
      </div>
    );
  }

  return (
    <div
      className="max-h-48 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      onKeyDown={handleKeyDown}
    >
      {items.map((user, index) => (
        <button
          key={user.id}
          onClick={() => command(user)}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors
            ${index === selectedIndex ? "bg-gray-100" : "hover:bg-gray-50"}`}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
            {user.name[0]}
          </span>
          <span>{user.name}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MentionNodeView                                                     */
/* ------------------------------------------------------------------ */

function MentionNodeView({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700"
      data-mention
    >
      @{(node.attrs as { label: string }).label}
    </NodeViewWrapper>
  );
}

/* ------------------------------------------------------------------ */
/*  TipTap Node extension                                               */
/* ------------------------------------------------------------------ */

export interface MentionExtensionOptions {
  suggestion: Record<string, unknown>;
}

export const Mention = Node.create<MentionExtensionOptions>({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return {
      suggestion: {
        char: "@",
        allowSpaces: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-mention]",
        getAttrs: (element) => ({
          id: (element as HTMLElement).getAttribute("data-mention-id"),
          label: (element as HTMLElement).getAttribute("data-mention-label"),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-mention": "",
        class: "mention",
      }),
      `@${HTMLAttributes.label}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionNodeView);
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      Suggestion({
        editor,
        char: "@",
        allowSpaces: false,
        items: ({ query }: { query: string }) => filterUsers(query),
        render: () => {
          let component: ReturnType<typeof import("@tiptap/react").ReactRenderer> | null = null;
          let popup: Array<{ hide: () => void; setProps: (props: Record<string, unknown>) => void; destroy: () => void }> | null = null;

          return {
            onStart: (props: SuggestionProps) => {
              const { ReactRenderer } = require("@tiptap/react") as typeof import("@tiptap/react");
              component = new ReactRenderer(MentionList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) return;

              const tippyModule = require("tippy.js");
              const tippyFn = tippyModule.default || tippyModule;
              popup = tippyFn("body", {
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
              return false;
            },
            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
        command: ({
          editor: ed,
          range,
          props,
        }: {
          editor: ReturnType<typeof Node["create"]> extends infer T ? T : never;
          range: { from: number; to: number };
          props: MentionUser;
        }) => {
          (ed as any)
            .chain()
            .focus()
            .insertContent([
              {
                type: "mention",
                attrs: {
                  id: props.id,
                  label: props.name,
                },
              },
              { type: "text", text: " " },
            ])
            .run();
        },
      }),
    ];
  },
});