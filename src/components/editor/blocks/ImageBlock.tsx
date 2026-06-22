"use client";

import { useState, useCallback, useRef } from "react";

interface ImageBlockProps {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  onSrcChange?: (src: string) => void;
  onAltChange?: (alt: string) => void;
  onCaptionChange?: (caption: string) => void;
  onWidthChange?: (width: number) => void;
  onRemove?: () => void;
  readOnly?: boolean;
}

export function ImageBlock({
  src,
  alt = "",
  caption = "",
  width = 100,
  onSrcChange,
  onAltChange,
  onCaptionChange,
  onWidthChange,
  onRemove,
  readOnly = false,
}: ImageBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) {
          onSrcChange?.(result);
          setIsEditing(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [onSrcChange]);

  const handleUrl = useCallback(() => {
    const url = window.prompt("Enter image URL:", src);
    if (url !== null && url !== src) {
      onSrcChange?.(url);
      setIsEditing(false);
    }
  }, [src, onSrcChange]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;

      const handleMouseMove = (e: MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;
        const containerWidth = container.parentElement?.clientWidth ?? 600;
        const diff = e.clientX - startXRef.current;
        const newWidth = Math.max(
          10,
          Math.min(100, startWidthRef.current + (diff / containerWidth) * 100),
        );
        onWidthChange?.(Math.round(newWidth));
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width, onWidthChange],
  );

  return (
    <figure
      ref={containerRef}
      className="image-block group relative my-3"
      style={{ width: `${width}%` }}
    >
      {/* Controls */}
      {!readOnly && (
        <div className="absolute -top-8 right-0 z-10 flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1 py-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title="Change image"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600"
              title="Remove image"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Edit panel */}
      {isEditing && (
        <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Upload file
            </button>
            <button
              onClick={handleUrl}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Paste URL
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Image */}
      {imageError ? (
        <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
          Failed to load image
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className="w-full rounded-lg object-cover"
          onError={() => setImageError(true)}
          draggable={false}
        />
      )}

      {/* Caption */}
      {!readOnly && onCaptionChange ? (
        <input
          type="text"
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Add a caption..."
          className="mt-2 w-full border-none bg-transparent text-center text-sm text-gray-500 placeholder:text-gray-400 focus:outline-none"
        />
      ) : caption ? (
        <figcaption className="mt-2 text-center text-sm text-gray-500">
          {caption}
        </figcaption>
      ) : null}

      {/* Resize handle */}
      {!readOnly && (
        <div
          className={`absolute bottom-0 right-0 h-4 w-4 cursor-se-resize ${
            isResizing ? "text-blue-500" : "text-gray-400 opacity-0 group-hover:opacity-100"
          } transition-opacity`}
          onMouseDown={handleResizeStart}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}
    </figure>
  );
}