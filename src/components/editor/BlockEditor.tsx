"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import { common, createLowlight } from "lowlight";

import { EditorToolbar } from "./EditorToolbar";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import { SlashMenu } from "./extensions/slash-menu";
import { DragHandle } from "./extensions/drag-handle";

const lowlight = createLowlight(common);

export interface BlockEditorProps {
  initialContent?: string;
  onSave?: (content: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export function BlockEditor({
  initialContent = "[]",
  onSave,
  readOnly = false,
  placeholder = "Type '/' for commands...",
  className = "",
  debounceMs = 500,
}: BlockEditorProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUpdate = useCallback(
    ({ editor }: { editor: ReturnType<typeof useEditor> extends infer T ? T : never }) => {
      if (!onSave) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const json = JSON.stringify(editor.getJSON());
        onSave(json);
      }, debounceMs);
    },
    [onSave, debounceMs],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline cursor-pointer hover:text-blue-800",
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Typography,
    ],
    content: (() => {
      try {
        return JSON.parse(initialContent);
      } catch {
        return initialContent;
      }
    })(),
    editable: !readOnly,
    onUpdate: readOnly ? undefined : handleUpdate,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl focus:outline-none min-h-[200px] px-4 py-3 max-w-none",
      },
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (editor && editor.isEditable !== !readOnly) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  if (!editor) return null;

  return (
    <div className={`block-editor flex flex-col ${className}`}>
      {!readOnly && <EditorToolbar editor={editor} />}
      <div className="relative flex-1">
        <EditorContent editor={editor} className="block-editor-content" />
        {!readOnly && (
          <>
            <EditorBubbleMenu editor={editor} />
            <SlashMenu editor={editor} />
            <DragHandle editor={editor} />
          </>
        )}
      </div>
    </div>
  );
}