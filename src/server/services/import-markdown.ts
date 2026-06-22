import type { TipTapDoc, TipTapNode } from "@/lib/serializer";

/**
 * Import service: Parse Markdown text into TipTap JSON document.
 *
 * Supports:
 *  - Headings (h1-h6)
 *  - Paragraphs with inline formatting (bold, italic, strikethrough, code, links)
 *  - Bullet and ordered lists (with nesting)
 *  - Task lists
 *  - Code blocks (with language)
 *  - Blockquotes (with nesting)
 *  - Images
 *  - Tables
 *  - Horizontal rules
 *  - Inline images
 */

/* ── Inline Parsing ──────────────────────────────────────────── */

interface InlineToken {
  text: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

const MARK_PATTERNS: [RegExp, string][] = [
  [/^\*\*\*(.+?)\*\*\*/, "bold"],    // ***bold italic***
  [/^___(.+?)___/, "bold"],           // ___bold italic___
  [/^\*\*(.+?)\*\*/, "bold"],         // **bold**
  [/^__(.+?)__/, "bold"],             // __bold__
  [/^\*(.+?)\*/, "italic"],           // *italic*
  [/^_(.+?)_/, "italic"],             // _italic_
  [/^~~(.+?)~~/, "strike"],           // ~~strikethrough~~
  [/^`(.+?)`/, "code"],              // `inline code`
];

const LINK_RE = /^\[([^\]]+)\]\(([^)]+)\)/;
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)/;

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Image
    const imgMatch = remaining.match(IMAGE_RE);
    if (imgMatch) {
      tokens.push({
        text: "",
        marks: [{ type: "image", attrs: { src: imgMatch[2], alt: imgMatch[1] } }],
      });
      remaining = remaining.slice(imgMatch[0].length);
      continue;
    }

    // Link
    const linkMatch = remaining.match(LINK_RE);
    if (linkMatch) {
      tokens.push({
        text: linkMatch[1],
        marks: [{ type: "link", attrs: { href: linkMatch[2] } }],
      });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Marks (bold, italic, etc.)
    let matched = false;
    for (const [pattern, markType] of MARK_PATTERNS) {
      const m = remaining.match(pattern);
      if (m) {
        tokens.push({ text: m[1], marks: [{ type: markType }] });
        remaining = remaining.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Plain text until next special character
    const nextSpecial = remaining.search(/[*_~`\[!]/);
    if (nextSpecial === -1) {
      tokens.push({ text: remaining });
      break;
    }
    if (nextSpecial === 0) {
      // Unrecognized special char, treat as plain text
      tokens.push({ text: remaining[0] });
      remaining = remaining.slice(1);
      continue;
    }
    tokens.push({ text: remaining.slice(0, nextSpecial) });
    remaining = remaining.slice(nextSpecial);
  }

  return tokens;
}

function inlineToContent(text: string): TipTapNode[] {
  return parseInline(text).map((t) => ({
    type: "text",
    text: t.text,
    ...(t.marks && t.marks.length > 0 ? { marks: t.marks } : {}),
  }));
}

/* ── Block Parsing ───────────────────────────────────────────── */

function parseTableRow(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

function parseTable(lines: string[], start: number): { node: TipTapNode; end: number } {
  const rows: TipTapNode[] = [];
  let i = start;

  while (i < lines.length && lines[i].includes("|")) {
    const line = lines[i];

    // Skip separator row
    if (/^\|[\s:|-]+\|$/.test(line) || /^[\s|:-]+$/.test(line)) {
      i++;
      continue;
    }

    const cells = parseTableRow(line);
    const isFirst = rows.length === 0;

    rows.push({
      type: "tableRow",
      content: cells.map((cellText) => ({
        type: isFirst ? "tableHeader" : "tableCell",
        content: [{ type: "paragraph", content: inlineToContent(cellText) }],
      })),
    });
    i++;
  }

  return {
    node: { type: "table", content: rows },
    end: i,
  };
}

function collectIndentedBlock(
  lines: string[],
  start: number,
  indent: number,
): { text: string; end: number } {
  const collected: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const currentIndent = line.length - line.trimStart().length;
    if (line.trim() === "" || currentIndent >= indent) {
      collected.push(line.trim());
      i++;
    } else {
      break;
    }
  }
  return { text: collected.join("\n"), end: i };
}

/**
 * Parse Markdown string into a TipTap JSON document.
 */
export function importMarkdown(markdown: string): TipTapDoc {
  const lines = markdown.split("\n");
  const content: TipTapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (trimmed === "") {
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || "plaintext";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      content.push({
        type: "codeBlock",
        attrs: { language: lang },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      continue;
    }

    // Table
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const { node, end } = parseTable(lines, i);
      content.push(node);
      i = end;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: inlineToContent(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      // Recursively parse the inner content
      const innerDoc = importMarkdown(quoteLines.join("\n"));
      content.push({
        type: "blockquote",
        content: innerDoc.content,
      });
      continue;
    }

    // Task list item
    const taskMatch = trimmed.match(/^[-*+]\s+\[([ xX])\]\s+(.*)/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === "x";
      const taskItems: TipTapNode[] = [];

      // Collect consecutive task items
      while (i < lines.length) {
        const tm = lines[i].trim().match(/^[-*+]\s+\[([ xX])\]\s+(.*)/);
        if (!tm) break;
        taskItems.push({
          type: "taskItem",
          attrs: { checked: tm[1].toLowerCase() === "x" },
          content: [{ type: "paragraph", content: inlineToContent(tm[2]) }],
        });
        i++;
      }
      content.push({ type: "taskList", content: taskItems });
      continue;
    }

    // Unordered list
    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      const listItems: TipTapNode[] = [];
      while (i < lines.length) {
        const bm = lines[i].trim().match(/^[-*+]\s+(.*)/);
        if (!bm) break;

        // Check for nested content (indented lines after this bullet)
        const nestedLines: string[] = [];
        i++;
        while (
          i < lines.length &&
          lines[i].trim() !== "" &&
          !lines[i].trim().match(/^[-*+]\s/) &&
          !lines[i].trim().match(/^\d+\.\s/) &&
          !lines[i].trim().startsWith("#") &&
          !lines[i].trim().startsWith(">") &&
          !lines[i].trim().startsWith("```") &&
          !lines[i].trim().startsWith("|")
        ) {
          const indent = lines[i].length - lines[i].trimStart().length;
          if (indent > 0) {
            nestedLines.push(lines[i].trim());
            i++;
          } else {
            break;
          }
        }

        const itemContent: TipTapNode[] = [
          { type: "paragraph", content: inlineToContent(bm[1]) },
        ];

        if (nestedLines.length > 0) {
          const nestedDoc = importMarkdown(nestedLines.join("\n"));
          itemContent.push(...nestedDoc.content);
        }

        listItems.push({ type: "listItem", content: itemContent });

        // Stop if next line is not a bullet
        if (i >= lines.length || !lines[i].trim().match(/^[-*+]\s/)) break;
      }
      content.push({ type: "bulletList", content: listItems });
      continue;
    }

    // Ordered list
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)/);
    if (orderedMatch) {
      const listItems: TipTapNode[] = [];
      while (i < lines.length) {
        const om = lines[i].trim().match(/^\d+\.\s+(.*)/);
        if (!om) break;

        const nestedLines: string[] = [];
        i++;
        while (
          i < lines.length &&
          lines[i].trim() !== "" &&
          !lines[i].trim().match(/^\d+\.\s/) &&
          !lines[i].trim().match(/^[-*+]\s/) &&
          !lines[i].trim().startsWith("#") &&
          !lines[i].trim().startsWith(">") &&
          !lines[i].trim().startsWith("```") &&
          !lines[i].trim().startsWith("|")
        ) {
          const indent = lines[i].length - lines[i].trimStart().length;
          if (indent > 0) {
            nestedLines.push(lines[i].trim());
            i++;
          } else {
            break;
          }
        }

        const itemContent: TipTapNode[] = [
          { type: "paragraph", content: inlineToContent(om[1]) },
        ];

        if (nestedLines.length > 0) {
          const nestedDoc = importMarkdown(nestedLines.join("\n"));
          itemContent.push(...nestedDoc.content);
        }

        listItems.push({ type: "listItem", content: itemContent });

        if (i >= lines.length || !lines[i].trim().match(/^\d+\.\s/)) break;
      }
      content.push({ type: "orderedList", content: listItems });
      continue;
    }

    // Image (standalone line)
    const imageMatch = trimmed.match(IMAGE_RE);
    if (imageMatch) {
      content.push({
        type: "image",
        attrs: { src: imageMatch[2], alt: imageMatch[1] },
      });
      i++;
      continue;
    }

    // Paragraph (default)
    content.push({
      type: "paragraph",
      content: inlineToContent(trimmed),
    });
    i++;
  }

  return { type: "doc", content };
}

/**
 * Parse markdown and extract a title from the first heading or first line.
 */
export function importMarkdownWithTitle(markdown: string): {
  title: string;
  doc: TipTapDoc;
} {
  const doc = importMarkdown(markdown);

  // Extract title from first heading
  const firstHeading = doc.content.find((n) => n.type === "heading");
  if (firstHeading) {
    const titleText = (firstHeading.content ?? [])
      .map((n) => n.text ?? "")
      .join("");
    return { title: titleText, doc };
  }

  // Fallback: first paragraph text
  const firstParagraph = doc.content.find((n) => n.type === "paragraph");
  if (firstParagraph) {
    const text = (firstParagraph.content ?? [])
      .map((n) => n.text ?? "")
      .join("");
    return { title: text.slice(0, 200) || "Untitled", doc };
  }

  return { title: "Untitled", doc };
}
