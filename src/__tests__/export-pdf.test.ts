import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TipTapDoc, TipTapNode } from "@/lib/serializer";

/**
 * Unit tests for export-pdf service.
 * Tests HTML generation from TipTap documents and PDF export.
 */

import { exportToHtml, exportPdfHtml, exportPdf } from "@/server/services/export-pdf";

function makeDoc(...nodes: TipTapNode[]): TipTapDoc {
  return { type: "doc", content: nodes };
}

function para(text: string): TipTapNode {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

function heading(level: number, text: string): TipTapNode {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

describe("export-pdf service", () => {
  describe("exportToHtml", () => {
    it("should generate a valid HTML document", () => {
      const html = exportToHtml("My Title", makeDoc(para("Hello")));
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain('<html lang="en">');
      expect(html).toContain("</html>");
      expect(html).toContain("<title>My Title</title>");
      expect(html).toContain("<h1>My Title</h1>");
    });

    it("should handle null title", () => {
      const html = exportToHtml(null, makeDoc(para("Content")));
      expect(html).toContain("<title></title>");
      expect(html).toContain("<h1></h1>");
    });

    it("should handle undefined doc", () => {
      const html = exportToHtml("Title", undefined);
      expect(html).toContain("<title>Title</title>");
      expect(html).toContain("<body>");
    });

    it("should handle empty content array", () => {
      const html = exportToHtml("Title", makeDoc());
      expect(html).toContain("<body>");
      expect(html).toContain("</body>");
    });

    it("should render paragraphs with text", () => {
      const html = exportToHtml("Title", makeDoc(para("Hello world")));
      expect(html).toContain("<p>Hello world</p>");
    });

    it("should render all heading levels", () => {
      const doc = makeDoc(
        heading(1, "H1"),
        heading(2, "H2"),
        heading(3, "H3"),
        heading(4, "H4"),
        heading(5, "H5"),
        heading(6, "H6"),
      );
      const html = exportToHtml("Title", doc);
      expect(html).toContain("<h1>H1</h1>");
      expect(html).toContain("<h2>H2</h2>");
      expect(html).toContain("<h3>H3</h3>");
      expect(html).toContain("<h4>H4</h4>");
      expect(html).toContain("<h5>H5</h5>");
      expect(html).toContain("<h6>H6</h6>");
    });

    it("should render bullet lists", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [para("Item 1")] },
              { type: "listItem", content: [para("Item 2")] },
            ],
          },
        ],
      };
      const html = exportToHtml("Title", doc);
      expect(html).toContain("<ul>");
      expect(html).toContain("<li>");
      expect(html).toContain("Item 1");
      expect(html).toContain("Item 2");
    });

    it("should render ordered lists", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "orderedList",
            content: [
              { type: "listItem", content: [para("First")] },
            ],
          },
        ],
      };
      const html = exportToHtml("Title", doc);
      expect(html).toContain("<ol>");
      expect(html).toContain("<li>");
      expect(html).toContain("First");
    });

    it("should render code blocks with language class", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "typescript" },
            content: [{ type: "text", text: "const x = 1;" }],
          },
        ],
      };
      const html = exportToHtml("Title", doc);
      expect(html).toContain("<pre>");
      expect(html).toContain("language-typescript");
      expect(html).toContain("const x = 1;");
    });

    it("should render images with src and alt", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { src: "https://example.com/img.png", alt: "My image" },
          },
        ],
      };
      const html = exportToHtml("Title", doc);
      expect(html).toContain('<img src="https://example.com/img.png"');
      expect(html).toContain('alt="My image"');
    });

    it("should render blockquotes", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [para("Quoted text")],
          },
        ],
      };
      const html = exportToHtml("Title", doc);
      expect(html).toContain("<blockquote>");
      expect(html).toContain("Quoted text");
    });

    it("should render horizontal rules", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [{ type: "horizontalRule" }],
      };
      const html = exportToHtml("Title", doc);
      expect(html).toContain("<hr />");
    });

    it("should render inline marks (bold, italic, code, link)", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "bold", marks: [{ type: "bold" }] },
              { type: "text", text: "italic", marks: [{ type: "italic" }] },
              { type: "text", text: "code", marks: [{ type: "code" }] },
              {
                type: "text",
                text: "link",
                marks: [{ type: "link", attrs: { href: "https://example.com" } }],
              },
            ],
          },
        ],
      };
      const html = exportToHtml("Title", doc);
      expect(html).toContain("<strong>bold</strong>");
      expect(html).toContain("<em>italic</em>");
      expect(html).toContain("<code>code</code>");
      expect(html).toContain('<a href="https://example.com">link</a>');
    });

    it("should escape HTML in text content", () => {
      const doc = makeDoc(para("<script>alert('xss')</script>"));
      const html = exportToHtml("Title", doc);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("exportPdfHtml", () => {
    it("should produce the same output as exportToHtml", () => {
      const doc = makeDoc(para("Test"));
      expect(exportPdfHtml("Title", doc)).toBe(exportToHtml("Title", doc));
    });
  });

  describe("exportPdf", () => {
    it("should call browserPdfFn with HTML and default options", async () => {
      const browserPdfFn = vi.fn().mockResolvedValue(Buffer.from("pdf-data"));
      const result = await exportPdf(browserPdfFn, {
        title: "Test",
        doc: makeDoc(para("Hello")),
      });
      expect(result).toBeInstanceOf(Buffer);
      expect(browserPdfFn).toHaveBeenCalledOnce();
      const [html, opts] = browserPdfFn.mock.calls[0];
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Hello");
      expect(opts.format).toBe("A4");
      expect(opts.landscape).toBe(false);
      expect(opts.printBackground).toBe(true);
    });

    it("should pass custom format and landscape options", async () => {
      const browserPdfFn = vi.fn().mockResolvedValue(Buffer.from("pdf"));
      await exportPdf(browserPdfFn, {
        title: "Test",
        doc: makeDoc(),
        format: "Letter",
        landscape: true,
      });
      const opts = browserPdfFn.mock.calls[0][1];
      expect(opts.format).toBe("Letter");
      expect(opts.landscape).toBe(true);
    });

    it("should pass custom margins", async () => {
      const browserPdfFn = vi.fn().mockResolvedValue(Buffer.from("pdf"));
      await exportPdf(browserPdfFn, {
        title: "Test",
        doc: makeDoc(),
        margins: { top: "2in", bottom: "2in", left: "0.5in", right: "0.5in" },
      });
      const opts = browserPdfFn.mock.calls[0][1];
      expect(opts.margin.top).toBe("2in");
      expect(opts.margin.left).toBe("0.5in");
    });
  });
});