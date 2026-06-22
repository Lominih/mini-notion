"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";

interface DragHandleProps {
  editor: Editor;
}

export function DragHandle({ editor }: DragHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [blockPos, setBlockPos] = useState({ top: 0 });
  const currentBlockRef = useRef<HTMLElement | null>(null);

  const findBlockNode = useCallback(
    (target: HTMLElement): HTMLElement | null => {
      const view = editor.view;
      let node: HTMLElement | null = target;

      while (node && node !== view.dom as unknown as HTMLElement) {
        if (
          node.classList?.contains("ProseMirror") ||
          node === (view.dom as unknown as HTMLElement)
        ) {
          return null;
        }

        const pos = view.posAtDOM(node, 0);
        if (pos !== undefined && pos >= 0) {
          const resolved = view.doc.resolve(pos);
          if (resolved.parent.type.name !== "doc") {
            return node;
          }
        }
        node = node.parentElement;
      }
      return null;
    },
    [editor],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) return;

      const target = e.target as HTMLElement;
      const blockNode = findBlockNode(target);

      if (blockNode && blockNode !== currentBlockRef.current) {
        currentBlockRef.current = blockNode;
        const rect = blockNode.getBoundingClientRect();
        setBlockPos({ top: rect.top });
        setIsVisible(true);
      } else if (!blockNode && isVisible) {
        setIsVisible(false);
        currentBlockRef.current = null;
      }
    },
    [editor, findBlockNode, isDragging, isVisible],
  );

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setIsVisible(false);
      currentBlockRef.current = null;
    }
  }, [isDragging]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!currentBlockRef.current) return;
      setIsDragging(true);

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "");

      const view = editor.view;
      const pos = view.posAtDOM(currentBlockRef.current, 0);
      if (pos !== undefined) {
        e.dataTransfer.setData(
          "application/x-prosemirror-node",
          JSON.stringify({ pos }),
        );
      }
    },
    [editor],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const data = e.dataTransfer.getData("application/x-prosemirror-node");
      if (!data) return;

      try {
        const { pos: fromPos } = JSON.parse(data);
        const view = editor.view;
        const dropPos = view.posAtCoords({
          left: e.clientX,
          top: e.clientY,
        });

        if (dropPos && fromPos !== dropPos.pos) {
          const tr = view.state.tr;
          const $from = view.doc.resolve(fromPos);
          const node = $from.node($from.depth);

          if (node) {
            const from = $from.start($from.depth);
            const to = from + node.nodeSize;
            const resolvedTo = view.doc.resolve(dropPos.pos);
            const insertPos = resolvedTo.before(resolvedTo.depth);

            tr.delete(from, to);
            const clonedNode = node.copy(node.content);
            tr.insert(insertPos, clonedNode);
            view.dispatch(tr);
          }
        }
      } catch {
        // ignore invalid data
      }
    },
    [editor],
  );

  useEffect(() => {
    const editorEl = editor.view.dom as unknown as HTMLElement;
    editorEl.addEventListener("mousemove", handleMouseMove);
    editorEl.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      editorEl.removeEventListener("mousemove", handleMouseMove);
      editorEl.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [editor, handleMouseMove, handleMouseLeave]);

  return (
    <div
      ref={handleRef}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={() => setIsDragging(false)}
      className={`absolute left-0 z-20 flex h-6 w-6 cursor-grab items-center justify-center rounded
        text-gray-400 transition-opacity hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing
        ${isVisible || isDragging ? "opacity-100" : "pointer-events-none opacity-0"}`}
      style={{
        top: `${blockPos.top}px`,
        transform: "translate(-100%, 2px)",
      }}
      title="Drag to reorder"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </div>
  );
}