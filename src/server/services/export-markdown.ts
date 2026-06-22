import type { TipTapDoc, TipTapNode, TipTapMark } from "@/lib/serializer";

/**
 * Export service: Convert TipTap JSON document to Markdown string.
 *
 * Supports all block types including headings, lists, task lists,
 * code blocks, blockquotes, tables, images, links, and inline formatting.
 */

/* ── Inline Marks ────────────────────────────────────────────────── */

function serializeMarks(text: string, marks?: TipTapMark[]): string {
  if (!marks || marks.length === 0) return text;

  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        result = `**${result}**`;
        break;
      case "italic":
        result = `*${result}*`;
        break;
      case "strike":
        result = `~~${result}~~`;
        break;
      case "code":
        result = `\`${result}\``;
        break;
      case "link":
        result = `[${result}](${mark.attrs?.href ?? ""})`;
        break;
      case "highlight":
        result = `==${result}==`;
        break;
      case "underline":
        result = `<u>${result}</u>`;
        break;
    }
  }
  return result;
}

/* ── Node Serialization ──────────────────────────────────────────── */

function serializeNode(node: TipTapNode): string {
  if (!node) return "";

  switch (node.type) {
    case "doc":
      return (node.content ?? []).map(serializeNode).join("\n\n");

    case "paragraph":
      return (node.content ?? []).map((n) => serializeInline(n)).join("");

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = "#".repeat(level);
      const text = (node.content ?? []).map((n) => serializeInline(n)).join("");
      return `${prefix} ${text}`;
    }

    case "bulletList":
      return (node.content ?? []).map(serializeNode).join("\n");

    case "orderedList":
      return (node.content ?? [])
        .map((item, i) => {
          const text = (item.content ?? []).map((n) => serializeInline(n)).join("");
          return `${i + 1}. ${text}`;
        })
        .join("\n");

    case "listItem":
      return (node.content ?? [])
        .map((n, i) => {
          const text = serializeNode(n);
          if (i === 0) return `- ${text}`;
          // Nested content: indent by 2 spaces
          return text.replace(/^/gm, "  ");
        })
        .join("\n");

    case "taskList":
      return (node.content ?? []).map(serializeNode).join("\n");

    case "taskItem": {
      const checked = (node.attrs?.checked as boolean) ?? false;
      const checkbox = checked ? "[x]" : "[ ]";
      const text = (node.content ?? []).map((n) => serializeInline(n)).join("");
      return `- ${checkbox} ${text}`;
    }

    case "blockquote": {
      const lines = (node.content ?? []).map(serializeNode).join("\n");
      return lines.replace(/^/gm, "> ");
    }

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const code = (node.content ?? []).map((n) => n.text ?? "").join("");
      return "```" + lang + "\n" + code + "\n```";
    }

    case "horizontalRule":
      return "---";

    case "hardBreak":
      return "  \n";

    case "image": {
      const src = (node.attrs?.src as string) ?? "";
      const alt = (node.attrs?.alt as string) ?? "";
      const title = node.attrs?.title as string | undefined;
      return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
    }

    case "table":
      return serializeTable(node);

    case "mention": {
      const label = (node.attrs?.label as string) ?? "";
      return `@${label}`;
    }

    default:
      if (node.content) {
        return node.content.map(serializeNode).join("\n");
      }
      return node.text ?? "";
  }
}

function serializeInline(node: TipTapNode): string {
  if (!node) return "";
  if (node.text !== undefined) {
    return serializeMarks(node.text, node.marks);
  }
  return serializeNode(node);
}

/* ── Table Serialization ─────────────────────────────────────────── */

function serializeTable(tableNode: TipTapNode): string {
  const rows = tableNode.content ?? [];
  if (rows.length === 0) return "";

  const lines: string[] = [];

  rows.forEach((row, rowIndex) => {
    const cells = row.content ?? [];
    const cellTexts = cells.map((cell) => {
      return (cell.content ?? [])
        .map((n) => serializeInline(n))
        .join(" ")
        .replace(/\|/g, "\\|")
        .trim();
    });
    lines.push("| " + cellTexts.join(" | ") + " |");

    // Add separator after first row (header)
    if (rowIndex === 0) {
      lines.push("| " + cellTexts.map(() => "---").join(" | ") + " |");
    }
  });

  return lines.join("\n");
}

/* ── Main Export ─────────────────────────────────────────────────── */

/**
 * Convert a TipTap JSON document to Markdown.
 */
export function exportMarkdown(doc: TipTapDoc | TipTapNode | null | undefined): string {
  if (!doc) return "";
  if (!doc.content && !("type" in doc)) return "";
  return serializeNode(doc as TipTapNode).trim();
}

/**
 * Convert a TipTap JSON string to Markdown.
 */
export function exportMarkdownFromString(json: string | null | undefined): string {
  if (!json) return "";
  try {
    const doc = JSON.parse(json) as TipTapDoc;
    return exportMarkdown(doc);
  } catch {
    return json;
  }
}

/**
 * Convert a TipTap document to Markdown with a title heading prepended.
 */
export function exportMarkdownWithTitle(title: string | null | undefined, doc: TipTapDoc | TipTapNode | null | undefined): string {
  const safeTitle = title ?? "";
  const content = exportMarkdown(doc);
  if (!safeTitle && !content) return "";
  if (!safeTitle) return content;
  return `# ${safeTitle}\n\n${content}`;
}
