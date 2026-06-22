import type { TipTapDoc, TipTapNode } from "@/lib/serializer";

/**
 * Export service: Convert TipTap JSON to PDF-ready HTML.
 *
 * Generates a styled HTML document from TipTap content that can be
 * rendered to PDF by a headless browser (Puppeteer/Playwright).
 *
 * Since no new packages are added, the PDF generation is exposed as a
 * function that accepts a generic browser printToPDF callback.
 */

/* ── TipTap to HTML ─────────────────────────────────────────────── */

function escapeHtml(text: string): string {
  if (text == null) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarks(text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]): string {
  if (!marks || marks.length === 0) return escapeHtml(text);

  let result = escapeHtml(text);
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        result = `<strong>${result}</strong>`;
        break;
      case "italic":
        result = `<em>${result}</em>`;
        break;
      case "strike":
        result = `<s>${result}</s>`;
        break;
      case "code":
        result = `<code>${result}</code>`;
        break;
      case "link":
        result = `<a href="${escapeHtml(String(mark.attrs?.href ?? ""))}">${result}</a>`;
        break;
      case "highlight":
        result = `<mark>${result}</mark>`;
        break;
      case "underline":
        result = `<u>${result}</u>`;
        break;
    }
  }
  return result;
}

function renderNode(node: TipTapNode): string {
  if (!node) return "";

  switch (node.type) {
    case "doc":
      return (node.content ?? []).map(renderNode).join("\n");

    case "paragraph":
      return `<p>${(node.content ?? []).map(renderInline).join("")}</p>`;

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const inner = (node.content ?? []).map(renderInline).join("");
      return `<h${level}>${inner}</h${level}>`;
    }

    case "bulletList":
      return `<ul>\n${(node.content ?? []).map(renderNode).join("\n")}\n</ul>`;

    case "orderedList":
      return `<ol>\n${(node.content ?? []).map(renderNode).join("\n")}\n</ol>`;

    case "listItem":
      return `<li>${(node.content ?? []).map(renderNode).join("")}</li>`;

    case "taskList":
      return `<ul class="task-list">\n${(node.content ?? []).map(renderNode).join("\n")}\n</ul>`;

    case "taskItem": {
      const checked = (node.attrs?.checked as boolean) ?? false;
      const checkbox = checked ? " checked disabled" : " disabled";
      return `<li class="task-item"><input type="checkbox"${checkbox}> ${(node.content ?? []).map(renderNode).join("")}</li>`;
    }

    case "blockquote": {
      const inner = (node.content ?? []).map(renderNode).join("\n");
      return `<blockquote>\n${inner}\n</blockquote>`;
    }

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const code = (node.content ?? []).map((n) => n.text ?? "").join("");
      return `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`;
    }

    case "horizontalRule":
      return "<hr />";

    case "hardBreak":
      return "<br />";

    case "image": {
      const src = escapeHtml(String(node.attrs?.src ?? ""));
      const alt = escapeHtml(String(node.attrs?.alt ?? ""));
      return `<img src="${src}" alt="${alt}" />`;
    }

    case "table":
      return renderTable(node);

    case "mention": {
      const label = escapeHtml(String(node.attrs?.label ?? ""));
      return `<span class="mention">@${label}</span>`;
    }

    default:
      if (node.content) {
        return node.content.map(renderNode).join("\n");
      }
      return escapeHtml(node.text ?? "");
  }
}

function renderInline(node: TipTapNode): string {
  if (!node) return "";
  if (node.text !== undefined) {
    return renderMarks(node.text, node.marks);
  }
  return renderNode(node);
}

function renderTable(tableNode: TipTapNode): string {
  const rows = tableNode.content ?? [];
  if (rows.length === 0) return "";

  let html = "<table>\n";

  rows.forEach((row, i) => {
    const tag = i === 0 ? "thead" : i === 1 ? "tbody" : "";
    if (tag === "thead") html += "<thead>\n";
    if (i === 1) html += "<tbody>\n";

    html += "  <tr>\n";
    for (const cell of row.content ?? []) {
      const cellTag = cell.type === "tableHeader" ? "th" : "td";
      const inner = (cell.content ?? []).map(renderNode).join("");
      html += `    <${cellTag}>${inner}</${cellTag}>\n`;
    }
    html += "  </tr>\n";

    if (i === 0) html += "</thead>\n";
  });

  if (rows.length > 1) html += "</tbody>\n";
  html += "</table>";
  return html;
}

/* ── Full HTML Document ─────────────────────────────────────────── */

const PDF_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #1a1a1a;
    padding: 40px;
    max-width: 800px;
    margin: 0 auto;
  }
  h1 { font-size: 2em; margin: 0.67em 0 0.5em; font-weight: 700; }
  h2 { font-size: 1.5em; margin: 0.83em 0 0.5em; font-weight: 600; }
  h3 { font-size: 1.17em; margin: 1em 0 0.5em; font-weight: 600; }
  h4 { font-size: 1em; margin: 1.33em 0 0.5em; font-weight: 600; }
  h5 { font-size: 0.83em; margin: 1.67em 0 0.5em; font-weight: 600; }
  h6 { font-size: 0.67em; margin: 2.33em 0 0.5em; font-weight: 600; }
  p { margin: 0 0 1em; }
  ul, ol { margin: 0 0 1em 1.5em; }
  li { margin: 0.25em 0; }
  li.task-item { list-style: none; margin-left: -1.5em; }
  .task-list { list-style: none; margin-left: 0; }
  blockquote {
    border-left: 3px solid #ddd;
    padding: 0.5em 1em;
    margin: 0 0 1em;
    color: #555;
    background: #f9f9f9;
  }
  pre {
    background: #f4f4f4;
    border-radius: 4px;
    padding: 1em;
    margin: 0 0 1em;
    overflow-x: auto;
  }
  code { font-family: "Fira Code", Consolas, monospace; font-size: 0.9em; }
  pre code { background: none; padding: 0; }
  :not(pre) > code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
  table { border-collapse: collapse; margin: 0 0 1em; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  img { max-width: 100%; height: auto; margin: 0.5em 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
  a { color: #2563eb; text-decoration: none; }
  mark { background: #fef08a; padding: 1px 3px; }
  @media print {
    body { padding: 0; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
  }
`;

/**
 * Generate a full HTML document from a TipTap document.
 */
export function exportToHtml(title: string | null | undefined, doc: TipTapDoc | null | undefined): string {
  const safeTitle = title ?? "";
  const bodyHtml = (doc?.content ?? []).map(renderNode).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(safeTitle)}</title>
  <style>${PDF_STYLES}</style>
</head>
<body>
  <h1>${escapeHtml(safeTitle)}</h1>
  ${bodyHtml}
</body>
</html>`;
}

/**
 * Generate a PDF-ready HTML buffer from a page's content.
 *
 * @param title  The page title
 * @param doc    The TipTap JSON document
 * @returns      An HTML string ready for browser-based PDF rendering
 */
export function exportPdfHtml(title: string | null | undefined, doc: TipTapDoc | null | undefined): string {
  return exportToHtml(title, doc);
}

/**
 * PDF export options for the browser printToPDF call.
 */
export interface PdfExportOptions {
  title: string;
  doc: TipTapDoc;
  format?: "A4" | "Letter" | "Legal";
  landscape?: boolean;
  margins?: { top?: string; bottom?: string; left?: string; right?: string };
}

/**
 * Generate PDF bytes from a TipTap document.
 *
 * Requires a browser instance with printToPDF capability.
 * Pass a callback that converts HTML to PDF bytes.
 *
 * @param browserPdfFn  async (html: string, opts) => Buffer - PDF renderer
 * @param options       Page title, content, and layout options
 * @returns             PDF as Buffer
 */
export async function exportPdf(
  browserPdfFn: (html: string, options: { format?: string; landscape?: boolean; printBackground?: boolean; margin?: Record<string, string> }) => Promise<Buffer>,
  options: PdfExportOptions,
): Promise<Buffer> {
  const title = options.title ?? "";
  const doc = options.doc ?? { type: "doc" as const, content: [] };
  const html = exportPdfHtml(title, doc);

  return browserPdfFn(html, {
    format: options.format ?? "A4",
    landscape: options.landscape ?? false,
    printBackground: true,
    margin: {
      top: options.margins?.top ?? "1in",
      bottom: options.margins?.bottom ?? "1in",
      left: options.margins?.left ?? "1in",
      right: options.margins?.right ?? "1in",
    },
  });
}
