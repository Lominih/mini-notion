import type { TipTapDoc, TipTapNode } from "@/lib/serializer";

/**
 * Import service: Parse HTML into TipTap JSON document.
 *
 * Supports common HTML elements:
 *  - Headings (h1-h6)
 *  - Paragraphs
 *  - Inline formatting: <strong>, <em>, <s>, <code>, <a>, <u>
 *  - Lists: <ul>, <ol>, <li> (with nesting)
 *  - Task lists: <input type="checkbox">
 *  - Blockquotes: <blockquote>
 *  - Pre/code blocks: <pre><code>
 *  - Tables: <table>, <thead>, <tbody>, <tr>, <th>, <td>
 *  - Images: <img>
 *  - Horizontal rules: <hr>
 *  - Divs and spans (treated as paragraphs/inline)
 */

/* ── HTML Tokenizer ─────────────────────────────────────────── */

interface HtmlToken {
  type: "tag" | "text";
  tag?: string;
  attrs?: Record<string, string>;
  selfClosing?: boolean;
  text?: string;
  voidElement?: boolean;
}

const VOID_ELEMENTS = new Set([
  "area","base","br","col","embed","hr","img","input",
  "link","meta","param","source","track","wbr",
]);

const SELF_CLOSING = new Set(["br","hr","img","input"]);

function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  let i = 0;

  while (i < html.length) {
    if (html[i] === "<") {
      // Comment
      if (html.slice(i, i + 4) === "<!--") {
        const end = html.indexOf("-->", i + 4);
        i = end === -1 ? html.length : end + 3;
        continue;
      }

      // Closing tag
      if (html[i + 1] === "/") {
        const closeEnd = html.indexOf(">", i + 2);
        if (closeEnd === -1) break;
        const tagName = html.slice(i + 2, closeEnd).trim().toLowerCase();
        tokens.push({ type: "tag", tag: tagName });
        i = closeEnd + 1;
        continue;
      }

      // Opening tag
      const tagEnd = html.indexOf(">", i + 1);
      if (tagEnd === -1) break;
      const tagContent = html.slice(i + 1, tagEnd);

      // Parse tag name and attributes
      const spaceIdx = tagContent.search(/\s/);
      const tagName = (
        spaceIdx === -1 ? tagContent : tagContent.slice(0, spaceIdx)
      ).toLowerCase();
      const attrStr = spaceIdx === -1 ? "" : tagContent.slice(spaceIdx + 1);

      const attrs: Record<string, string> = {};
      const attrRe = /(\w[\w-]*)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let am: RegExpExecArray | null;
      while ((am = attrRe.exec(attrStr)) !== null) {
        attrs[am[1]] = am[2] ?? am[3] ?? am[4] ?? "";
      }
      // Boolean attributes
      const boolRe = /\b([\w-]+)(?=\s|$)/g;
      let bm: RegExpExecArray | null;
      while ((bm = boolRe.exec(attrStr)) !== null) {
        if (!(bm[1] in attrs)) attrs[bm[1]] = "true";
      }

      const isVoid = VOID_ELEMENTS.has(tagName);
      const isSelfClosing = SELF_CLOSING.has(tagName) || tagContent.endsWith("/");
      tokens.push({
        type: "tag",
        tag: tagName,
        attrs,
        selfClosing: isSelfClosing || isVoid,
        voidElement: isVoid,
      });
      i = tagEnd + 1;
      continue;
    }

    // Text node
    const nextTag = html.indexOf("<", i);
    const textEnd = nextTag === -1 ? html.length : nextTag;
    const text = html.slice(i, textEnd);
    if (text.trim()) {
      tokens.push({ type: "text", text });
    }
    i = textEnd;
  }

  return tokens;
}

/* ── DOM Tree Builder ───────────────────────────────────────── */

interface DomNode {
  tag?: string;
  attrs?: Record<string, string>;
  children: (DomNode | string)[];
}

function buildDomTree(tokens: HtmlToken[]): DomNode[] {
  const root: DomNode[] = [];
  const stack: DomNode[] = [{ children: root }];

  for (const token of tokens) {
    const parent = stack[stack.length - 1];

    if (token.type === "text") {
      parent.children.push(token.text ?? "");
      continue;
    }

    if (token.type === "tag") {
      if (token.tag?.startsWith("/")) {
        // Closing tag
        if (stack.length > 1) stack.pop();
        continue;
      }

      if (token.selfClosing || token.voidElement) {
        parent.children.push({ tag: token.tag, attrs: token.attrs, children: [] });
        continue;
      }

      const node: DomNode = { tag: token.tag, attrs: token.attrs, children: [] };
      parent.children.push(node);
      stack.push(node);
    }
  }

  return root;
}

/* ── HTML to TipTap Conversion ──────────────────────────────── */

function getTextContent(node: DomNode): string {
  return node.children
    .map((c) => (typeof c === "string" ? c : getTextContent(c)))
    .join("");
}

function parseInlineFromDom(node: DomNode): TipTapNode[] {
  const result: TipTapNode[] = [];

  for (const child of node.children) {
    if (typeof child === "string") {
      if (child.trim()) {
        result.push({ type: "text", text: child });
      }
      continue;
    }

    const tag = child.tag ?? "";
    const text = getTextContent(child);

    switch (tag) {
      case "strong":
      case "b":
        result.push({ type: "text", text, marks: [{ type: "bold" }] });
        break;
      case "em":
      case "i":
        result.push({ type: "text", text, marks: [{ type: "italic" }] });
        break;
      case "s":
      case "del":
      case "strike":
        result.push({ type: "text", text, marks: [{ type: "strike" }] });
        break;
      case "code":
        result.push({ type: "text", text, marks: [{ type: "code" }] });
        break;
      case "u":
        result.push({ type: "text", text, marks: [{ type: "underline" }] });
        break;
      case "a":
        result.push({
          type: "text",
          text,
          marks: [{ type: "link", attrs: { href: child.attrs?.href ?? "#" } }],
        });
        break;
      case "img":
        result.push({
          type: "image",
          attrs: {
            src: child.attrs?.src ?? "",
            alt: child.attrs?.alt ?? "",
          },
        });
        break;
      case "br":
        result.push({ type: "hardBreak" });
        break;
      case "span":
      case "mark":
        result.push(...parseInlineFromDom(child));
        break;
      default:
        if (text.trim()) {
          result.push({ type: "text", text });
        }
        break;
    }
  }

  return result;
}

function domToTipTap(nodes: DomNode[]): TipTapNode[] {
  const blocks: TipTapNode[] = [];

  for (const node of nodes) {
    const tag = node.tag ?? "";

    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        blocks.push({
          type: "heading",
          attrs: { level: parseInt(tag[1]) },
          content: parseInlineFromDom(node),
        });
        break;

      case "p":
        blocks.push({
          type: "paragraph",
          content: parseInlineFromDom(node),
        });
        break;

      case "pre": {
        const codeNode = node.children.find(
          (c) => typeof c !== "string" && c.tag === "code",
        ) as DomNode | undefined;
        const lang =
          codeNode?.attrs?.className?.match(/language-(\w+)/)?.[1] ?? "plaintext";
        const code = codeNode ? getTextContent(codeNode) : getTextContent(node);
        blocks.push({
          type: "codeBlock",
          attrs: { language: lang },
          content: [{ type: "text", text: code }],
        });
        break;
      }

      case "blockquote": {
        const inner = domToTipTap(node.children.filter((c) => typeof c !== "string") as DomNode[]);
        blocks.push({ type: "blockquote", content: inner.length > 0 ? inner : [{ type: "paragraph" }] });
        break;
      }

      case "ul": {
        const items: TipTapNode[] = [];
        for (const child of node.children) {
          if (typeof child === "string" || child.tag !== "li") continue;

          // Check for checkbox
          const checkbox = child.children.find(
            (c) => typeof c !== "string" && c.tag === "input",
          ) as DomNode | undefined;
          const isChecked = checkbox?.attrs?.checked === "true";

          if (checkbox) {
            const textNodes = child.children.filter(
              (c) => typeof c === "string" || (typeof c !== "string" && c.tag !== "input"),
            );
            const text = textNodes
              .map((t) => (typeof t === "string" ? t : getTextContent(t)))
              .join("")
              .trim();
            items.push({
              type: "taskItem",
              attrs: { checked: isChecked },
              content: [{ type: "paragraph", content: [{ type: "text", text }] }],
            });
          } else {
            const nestedUl = child.children.find(
              (c) => typeof c !== "string" && c.tag === "ul",
            ) as DomNode | undefined;
            const content: TipTapNode[] = [
              { type: "paragraph", content: parseInlineFromDom(child) },
            ];
            if (nestedUl) {
              const nestedItems = domToTipTap([nestedUl]);
              content.push(...nestedItems);
            }
            items.push({ type: "listItem", content });
          }
        }

        if (items.length > 0 && items[0].type === "taskItem") {
          blocks.push({ type: "taskList", content: items });
        } else {
          blocks.push({ type: "bulletList", content: items });
        }
        break;
      }

      case "ol": {
        const items: TipTapNode[] = [];
        for (const child of node.children) {
          if (typeof child === "string" || child.tag !== "li") continue;
          const nestedOl = child.children.find(
            (c) => typeof c !== "string" && c.tag === "ol",
          ) as DomNode | undefined;
          const content: TipTapNode[] = [
            { type: "paragraph", content: parseInlineFromDom(child) },
          ];
          if (nestedOl) {
            content.push(...domToTipTap([nestedOl]));
          }
          items.push({ type: "listItem", content });
        }
        blocks.push({ type: "orderedList", content: items });
        break;
      }

      case "table": {
        const rows: TipTapNode[] = [];
        const allTr: DomNode[] = [];

        const thead = node.children.find(
          (c) => typeof c !== "string" && c.tag === "thead",
        ) as DomNode | undefined;
        const tbody = node.children.find(
          (c) => typeof c !== "string" && c.tag === "tbody",
        ) as DomNode | undefined;

        if (thead) {
          for (const c of thead.children) {
            if (typeof c !== "string" && c.tag === "tr") allTr.push(c);
          }
        }
        if (tbody) {
          for (const c of tbody.children) {
            if (typeof c !== "string" && c.tag === "tr") allTr.push(c);
          }
        }
        if (allTr.length === 0) {
          for (const c of node.children) {
            if (typeof c !== "string" && c.tag === "tr") allTr.push(c);
          }
        }

        let isFirstRow = true;
        for (const tr of allTr) {
          const cells: TipTapNode[] = [];
          for (const c of tr.children) {
            if (typeof c === "string") continue;
            if (c.tag === "th" || c.tag === "td") {
              cells.push({
                type: isFirstRow ? "tableHeader" : "tableCell",
                content: [{ type: "paragraph", content: parseInlineFromDom(c) }],
              });
            }
          }
          rows.push({ type: "tableRow", content: cells });
          isFirstRow = false;
        }

        blocks.push({ type: "table", content: rows });
        break;
      }

      case "hr":
        blocks.push({ type: "horizontalRule" });
        break;

      case "img":
        blocks.push({
          type: "image",
          attrs: {
            src: node.attrs?.src ?? "",
            alt: node.attrs?.alt ?? "",
          },
        });
        break;

      case "div":
      case "section":
      case "article":
      case "main":
      case "header":
      case "footer":
      case "aside":
      case "nav": {
        const inner = domToTipTap(node.children.filter((c) => typeof c !== "string") as DomNode[]);
        blocks.push(...inner);
        break;
      }

      case "br":
        blocks.push({ type: "hardBreak" });
        break;

      case "li":
      case "tr":
      case "thead":
      case "tbody":
      case "th":
      case "td":
        // These are handled by their parent containers
        break;

      default: {
        // Generic inline container or unknown element
        const text = getTextContent(node);
        if (text.trim()) {
          blocks.push({
            type: "paragraph",
            content: parseInlineFromDom(node),
          });
        }
        break;
      }
    }
  }

  return blocks;
}

/**
 * Parse an HTML string into a TipTap JSON document.
 */
export function importHtml(html: string): TipTapDoc {
  const tokens = tokenizeHtml(html);
  const dom = buildDomTree(tokens);
  const content = domToTipTap(dom);

  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

/**
 * Parse HTML and extract a title from the first <h1>-<h6> or <title> tag.
 */
export function importHtmlWithTitle(html: string): {
  title: string;
  doc: TipTapDoc;
} {
  const doc = importHtml(html);

  // Try to find first heading in content
  const firstHeading = doc.content.find((n) => n.type === "heading");
  if (firstHeading) {
    const titleText = (firstHeading.content ?? [])
      .map((n) => n.text ?? "")
      .join("");
    return { title: titleText, doc };
  }

  // Try <title> tag from the HTML
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return { title: titleMatch[1].trim(), doc };
  }

  // Fallback
  const firstPara = doc.content.find((n) => n.type === "paragraph");
  if (firstPara) {
    const text = (firstPara.content ?? [])
      .map((n) => n.text ?? "")
      .join("");
    return { title: text.slice(0, 200) || "Untitled", doc };
  }

  return { title: "Untitled", doc };
}
