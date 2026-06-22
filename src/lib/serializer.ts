/* ------------------------------------------------------------------ */
/*  Mini Notion â?Page Content Serializer                               */
/*  Converts between TipTap JSON, Markdown, and plain-text blocks.      */
/* ------------------------------------------------------------------ */

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapDoc {
  type: "doc";
  content: TipTapNode[];
}

/* ================================================================== */
/*  TipTap JSON â?Markdown                                             */
/* ================================================================== */

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
      case "highlight": {
        const color = mark.attrs?.color as string | undefined;
        if (color) {
          result = `==${result}==`;
        } else {
          result = `==${result}==`;
        }
        break;
      }
    }
  }
  return result;
}

function serializeNode(node: TipTapNode): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map(serializeNode).join("\n\n");

    case "paragraph":
      return (node.content ?? []).map((n) => serializeMarks(n.text ?? "", n.marks)).join("");

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = "#".repeat(level);
      const text = (node.content ?? []).map((n) => serializeMarks(n.text ?? "", n.marks)).join("");
      return `${prefix} ${text}`;
    }

    case "bulletList":
      return (node.content ?? []).map(serializeNode).join("\n");

    case "orderedList":
      return (node.content ?? []).map((item, i) => {
        const text = (item.content ?? []).map((n) => serializeMarks(n.text ?? "", n.marks)).join("");
        return `${i + 1}. ${text}`;
      }).join("\n");

    case "listItem":
      return (node.content ?? []).map(serializeNode).join("\n").replace(/^/gm, "- ");

    case "taskList":
      return (node.content ?? []).map(serializeNode).join("\n");

    case "taskItem": {
      const checked = (node.attrs?.checked as boolean) ?? false;
      const checkbox = checked ? "[x]" : "[ ]";
      const text = (node.content ?? []).map((n) => serializeNode(n)).join("");
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

function serializeTable(tableNode: TipTapNode): string {
  const rows = tableNode.content ?? [];
  if (rows.length === 0) return "";

  const lines: string[] = [];

  rows.forEach((row, rowIndex) => {
    const cells = row.content ?? [];
    const cellTexts = cells.map((cell) => {
      return (cell.content ?? [])
        .map((n) => serializeMarks(n.text ?? "", n.marks))
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

export function tiptapToMarkdown(json: string | TipTapDoc): string {
  const doc = typeof json === "string" ? (JSON.parse(json) as TipTapDoc) : json;
  return serializeNode(doc);
}

/* ================================================================== */
/*  Markdown â?TipTap JSON                                             */
/* ================================================================== */

export function markdownToTipTap(markdown: string): TipTapDoc {
  const lines = markdown.split("\n");
  const content: TipTapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line â?paragraph break
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      content.push({
        type: "heading",
        attrs: { level },
        content: parseInlineContent(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      content.push({
        type: "codeBlock",
        attrs: { language: lang || "plaintext" },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      content.push({
        type: "blockquote",
        content: quoteLines.map((ql) => ({
          type: "paragraph",
          content: parseInlineContent(ql),
        })),
      });
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && /[\|:-]+/.test(lines[i + 1])) {
      const table = parseMarkdownTable(lines, i);
      content.push(table.node);
      i = table.endIndex;
      continue;
    }

    // Task list item
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === "x";
      const text = taskMatch[2];
      // Check if there's already a taskList in progress
      const lastNode = content[content.length - 1];
      if (lastNode?.type === "taskList") {
        lastNode.content!.push({
          type: "taskItem",
          attrs: { checked },
          content: [{ type: "paragraph", content: parseInlineContent(text) }],
        });
      } else {
        content.push({
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked },
              content: [{ type: "paragraph", content: parseInlineContent(text) }],
            },
          ],
        });
      }
      i++;
      continue;
    }

    // Bullet list item
    const bulletMatch = line.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      const text = bulletMatch[1];
      const lastNode = content[content.length - 1];
      if (lastNode?.type === "bulletList") {
        lastNode.content!.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInlineContent(text) }],
        });
      } else {
        content.push({
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: parseInlineContent(text) }],
            },
          ],
        });
      }
      i++;
      continue;
    }

    // Ordered list item
    const orderedMatch = line.match(/^\d+\.\s+(.*)/);
    if (orderedMatch) {
      const text = orderedMatch[1];
      const lastNode = content[content.length - 1];
      if (lastNode?.type === "orderedList") {
        lastNode.content!.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInlineContent(text) }],
        });
      } else {
        content.push({
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: parseInlineContent(text) }],
            },
          ],
        });
      }
      i++;
      continue;
    }

    // Image
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+?)(?:\s+"[^"]*")?\)/);
    if (imageMatch) {
      content.push({
        type: "image",
        attrs: { src: imageMatch[2], alt: imageMatch[1] },
      });
      i++;
      continue;
    }

    // Default: paragraph
    content.push({
      type: "paragraph",
      content: parseInlineContent(line),
    });
    i++;
  }

  return { type: "doc", content };
}

function parseInlineContent(text: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  // Regex that captures bold, italic, code, links, images, highlight
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`([^`]+)`|!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|==(.+?)==)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      // bold + italic
      nodes.push({
        type: "text",
        text: match[2],
        marks: [{ type: "bold" }, { type: "italic" }],
      });
    } else if (match[3]) {
      // bold
      nodes.push({
        type: "text",
        text: match[3],
        marks: [{ type: "bold" }],
      });
    } else if (match[4]) {
      // italic
      nodes.push({
        type: "text",
        text: match[4],
        marks: [{ type: "italic" }],
      });
    } else if (match[5]) {
      // strikethrough
      nodes.push({
        type: "text",
        text: match[5],
        marks: [{ type: "strike" }],
      });
    } else if (match[6]) {
      // inline code
      nodes.push({
        type: "text",
        text: match[6],
        marks: [{ type: "code" }],
      });
    } else if (match[7] !== undefined) {
      // image
      nodes.push({
        type: "image",
        attrs: { src: match[8], alt: match[7] },
      });
    } else if (match[9] !== undefined) {
      // link
      nodes.push({
        type: "text",
        text: match[9],
        marks: [{ type: "link", attrs: { href: match[10] } }],
      });
    } else if (match[11]) {
      // highlight
      nodes.push({
        type: "text",
        text: match[11],
        marks: [{ type: "highlight" }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text }];
}

function parseMarkdownTable(
  lines: string[],
  startIndex: number,
): { node: TipTapNode; endIndex: number } {
  const rows: TipTapNode[] = [];
  let i = startIndex;

  while (i < lines.length && lines[i].includes("|")) {
    const line = lines[i];

    // Skip separator row
    if (/^[\s|:-]+$/.test(line)) {
      i++;
      continue;
    }

    const cells = line
      .split("|")
      .slice(1, -1) // remove first and last empty strings
      .map((cell) => cell.trim());

    const isFirst = rows.length === 0;
    rows.push({
      type: "tableRow",
      content: cells.map((cellText) => ({
        type: isFirst ? "tableHeader" : "tableCell",
        content: [{ type: "paragraph", content: parseInlineContent(cellText) }],
      })),
    });

    i++;
  }

  return {
    node: { type: "table", content: rows },
    endIndex: i,
  };
}

/* ================================================================== */
/*  Plain Text â?TipTap JSON blocks                                    */
/* ================================================================== */

export function plainTextToBlocks(text: string): TipTapDoc {
  const lines = text.split("\n");
  const content: TipTapNode[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }

    // Heading detection (e.g., "Heading 1:" or "# heading")
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: [{ type: "text", text: headingMatch[2] }],
      });
      continue;
    }

    // Horizontal rule detection
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      content.push({ type: "horizontalRule" });
      continue;
    }

    // Task detection
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)/);
    if (taskMatch) {
      content.push({
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: taskMatch[1].toLowerCase() === "x" },
            content: [{ type: "paragraph", content: [{ type: "text", text: taskMatch[2] }] }],
          },
        ],
      });
      continue;
    }

    // Bullet list detection
    const bulletMatch = line.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      const lastNode = content[content.length - 1];
      const listItem: TipTapNode = {
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: bulletMatch[1] }] }],
      };
      if (lastNode?.type === "bulletList") {
        lastNode.content!.push(listItem);
      } else {
        content.push({ type: "bulletList", content: [listItem] });
      }
      continue;
    }

    // Ordered list detection
    const orderedMatch = line.match(/^\d+\.\s+(.*)/);
    if (orderedMatch) {
      const lastNode = content[content.length - 1];
      const listItem: TipTapNode = {
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: orderedMatch[1] }] }],
      };
      if (lastNode?.type === "orderedList") {
        lastNode.content!.push(listItem);
      } else {
        content.push({ type: "orderedList", content: [listItem] });
      }
      continue;
    }

    // Quote detection
    if (line.startsWith("> ")) {
      content.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: line.slice(2) }],
          },
        ],
      });
      continue;
    }

    // Code block detection
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || "plaintext";
      content.push({
        type: "codeBlock",
        attrs: { language: lang },
        content: [{ type: "text", text: "" }],
      });
      continue;
    }

    // Image detection
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      content.push({
        type: "image",
        attrs: { src: imageMatch[2], alt: imageMatch[1] },
      });
      continue;
    }

    // Default paragraph
    content.push({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    });
  }

  return { type: "doc", content };
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

export function emptyDocument(): TipTapDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function documentToJSON(doc: TipTapDoc): string {
  return JSON.stringify(doc);
}

export function jsonToDocument(json: string): TipTapDoc {
  try {
    return JSON.parse(json) as TipTapDoc;
  } catch {
    return plainTextToBlocks(json);
  }
}