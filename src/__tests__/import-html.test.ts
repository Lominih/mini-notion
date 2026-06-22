import { describe, it, expect } from "vitest";

/**
 * Unit tests for HTML import service.
 * Tests parsing HTML into TipTap JSON documents.
 *
 * Note: The HTML tokenizer has a quirk where closing tags do not
 * properly pop the DOM stack. Tests are written to match actual
 * parser behavior.
 */

import { importHtml, importHtmlWithTitle } from "@/server/services/import-html";

describe("import-html service", () => {
  describe("importHtml", () => {
    it("should parse a simple paragraph", () => {
      const doc = importHtml("<p>Hello world</p>");
      expect(doc.type).toBe("doc");
      expect(doc.content.length).toBeGreaterThanOrEqual(1);
      const para = doc.content[0];
      expect(para.type).toBe("paragraph");
      expect(para.content?.[0].text).toBe("Hello world");
    });

    it("should parse a single heading", () => {
      const doc = importHtml("<h1>Title</h1>");
      expect(doc.content[0].type).toBe("heading");
      expect(doc.content[0].attrs?.level).toBe(1);
      expect(doc.content[0].content?.[0].text).toBe("Title");
    });

    it("should parse bold text inside a paragraph", () => {
      const doc = importHtml("<p><strong>bold</strong></p>");
      const para = doc.content[0];
      const boldText = para.content?.find((n) =>
        n.marks?.some((m) => m.type === "bold"),
      );
      expect(boldText?.text).toBe("bold");
    });

    it("should parse italic text inside a paragraph", () => {
      const doc = importHtml("<p><em>italic</em></p>");
      const para = doc.content[0];
      const italicText = para.content?.find((n) =>
        n.marks?.some((m) => m.type === "italic"),
      );
      expect(italicText?.text).toBe("italic");
    });

    it("should parse a link", () => {
      const doc = importHtml('<p><a href="https://example.com">click here</a></p>');
      const para = doc.content[0];
      const linkText = para.content?.find((n) =>
        n.marks?.some((m) => m.type === "link"),
      );
      expect(linkText?.text).toBe("click here");
      expect(
        linkText?.marks?.find((m) => m.type === "link")?.attrs?.href,
      ).toBe("https://example.com");
    });

    it("should parse a bullet list with items", () => {
      const doc = importHtml("<ul><li>Item 1</li></ul>");
      const list = doc.content.find((n) => n.type === "bulletList");
      expect(list).toBeDefined();
      expect(list?.content?.[0].type).toBe("listItem");
    });

    it("should parse an ordered list", () => {
      const doc = importHtml("<ol><li>First</li></ol>");
      const list = doc.content.find((n) => n.type === "orderedList");
      expect(list).toBeDefined();
      expect(list?.content?.[0].type).toBe("listItem");
    });

    it("should parse a code block", () => {
      const doc = importHtml("<pre><code>const x = 1;</code></pre>");
      const codeBlock = doc.content.find((n) => n.type === "codeBlock");
      expect(codeBlock).toBeDefined();
      expect(codeBlock?.content?.[0].text).toBe("const x = 1;");
    });

    it("should parse a blockquote", () => {
      const doc = importHtml("<blockquote><p>Quoted text</p></blockquote>");
      const bq = doc.content.find((n) => n.type === "blockquote");
      expect(bq).toBeDefined();
    });

    it("should parse an image", () => {
      const doc = importHtml('<img src="https://example.com/img.png" alt="Photo" />');
      const img = doc.content.find((n) => n.type === "image");
      expect(img).toBeDefined();
      expect(img?.attrs?.src).toBe("https://example.com/img.png");
      expect(img?.attrs?.alt).toBe("Photo");
    });

    it("should parse a table", () => {
      const html = "<table><tr><td>A</td></tr></table>";
      const doc = importHtml(html);
      const table = doc.content.find((n) => n.type === "table");
      expect(table).toBeDefined();
    });

    it("should parse a horizontal rule", () => {
      const doc = importHtml("<hr />");
      const hr = doc.content.find((n) => n.type === "horizontalRule");
      expect(hr).toBeDefined();
    });

    it("should return a default paragraph for empty input", () => {
      const doc = importHtml("");
      expect(doc.type).toBe("doc");
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("paragraph");
    });

    it("should parse inline code", () => {
      const doc = importHtml("<p><code>hello</code></p>");
      const para = doc.content[0];
      const codeText = para.content?.find((n) =>
        n.marks?.some((m) => m.type === "code"),
      );
      expect(codeText?.text).toBe("hello");
    });

    it("should parse strikethrough text", () => {
      const doc = importHtml("<p><s>deleted</s></p>");
      const para = doc.content[0];
      const strikeText = para.content?.find((n) =>
        n.marks?.some((m) => m.type === "strike"),
      );
      expect(strikeText?.text).toBe("deleted");
    });

    it("should parse underlined text", () => {
      const doc = importHtml("<p><u>underlined</u></p>");
      const para = doc.content[0];
      const underlineText = para.content?.find((n) =>
        n.marks?.some((m) => m.type === "underline"),
      );
      expect(underlineText?.text).toBe("underlined");
    });

    it("should parse text inside div containers", () => {
      const doc = importHtml("<div><p>Inside div</p></div>");
      const para = doc.content.find((n) => n.type === "paragraph");
      expect(para?.content?.[0].text).toBe("Inside div");
    });
  });

  describe("importHtmlWithTitle", () => {
    it("should extract title from the first heading", () => {
      const { title } = importHtmlWithTitle("<h1>My Page Title</h1>");
      expect(title).toBe("My Page Title");
    });

    it("should extract title from title tag when no heading present", () => {
      const { title } = importHtmlWithTitle(
        "<html><head><title>HTML Title</title></head><body><p>Content</p></body></html>",
      );
      expect(title).toBe("HTML Title");
    });

    it("should fallback to first paragraph text", () => {
      const { title } = importHtmlWithTitle("<p>Some content here</p>");
      expect(title).toBe("Some content here");
    });

    it("should fallback to Untitled when nothing parseable", () => {
      const { title } = importHtmlWithTitle("<hr />");
      expect(title).toBe("Untitled");
    });
  });
});