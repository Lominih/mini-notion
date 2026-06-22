import { describe, it, expect } from "vitest";
import {
  exportMarkdown,
  exportMarkdownFromString,
  exportMarkdownWithTitle,
} from "@/server/services/export-markdown";
import type { TipTapDoc } from "@/lib/serializer";

/**
 * Unit tests for the Markdown export service.
 * Tests conversion of TipTap JSON blocks to Markdown strings.
 */

describe("export-markdown service", () => {
  describe("exportMarkdown", () => {
    it("should convert a doc with paragraphs", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
        ],
      };
      expect(exportMarkdown(doc)).toBe("Hello world");
    });

    it("should convert headings at all levels", () => {
      for (let level = 1; level <= 6; level++) {
        const doc: TipTapDoc = {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level },
              content: [{ type: "text", text: `Heading ${level}` }],
            },
          ],
        };
        const md = exportMarkdown(doc);
        expect(md).toBe(`${"#".repeat(level)} Heading ${level}`);
      }
    });

    it("should convert bold text", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "bold", marks: [{ type: "bold" }] }],
          },
        ],
      };
      expect(exportMarkdown(doc)).toBe("**bold**");
    });

    it("should convert italic text", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "italic", marks: [{ type: "italic" }] }],
          },
        ],
      };
      expect(exportMarkdown(doc)).toBe("*italic*");
    });

    it("should convert strikethrough text", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "deleted", marks: [{ type: "strike" }] }],
          },
        ],
      };
      expect(exportMarkdown(doc)).toBe("~~deleted~~");
    });

    it("should convert inline code", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "code", marks: [{ type: "code" }] }],
          },
        ],
      };
      expect(exportMarkdown(doc)).toBe("`code`");
    });

    it("should convert links", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Google",
                marks: [{ type: "link", attrs: { href: "https://google.com" } }],
              },
            ],
          },
        ],
      };
      expect(exportMarkdown(doc)).toBe("[Google](https://google.com)");
    });

    it("should convert bullet lists", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Item 1" }] }],
              },
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Item 2" }] }],
              },
            ],
          },
        ],
      };
      const md = exportMarkdown(doc);
      expect(md).toContain("- Item 1");
      expect(md).toContain("- Item 2");
    });

    it("should convert ordered lists", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }],
              },
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }],
              },
            ],
          },
        ],
      };
      const md = exportMarkdown(doc);
      expect(md).toContain("1. First");
      expect(md).toContain("2. Second");
    });

    it("should convert code blocks", () => {
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
      const md = exportMarkdown(doc);
      expect(md).toContain("```typescript");
      expect(md).toContain("const x = 1;");
    });

    it("should convert blockquotes", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "A quote" }] },
            ],
          },
        ],
      };
      const md = exportMarkdown(doc);
      expect(md).toContain("> A quote");
    });

    it("should convert horizontal rules", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [{ type: "horizontalRule" }],
      };
      expect(exportMarkdown(doc)).toBe("---");
    });

    it("should convert images", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { src: "https://example.com/img.png", alt: "photo" },
          },
        ],
      };
      expect(exportMarkdown(doc)).toBe("![photo](https://example.com/img.png)");
    });

    it("should convert task lists", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "taskList",
            content: [
              {
                type: "taskItem",
                attrs: { checked: true },
                content: [{ type: "paragraph", content: [{ type: "text", text: "Done" }] }],
              },
              {
                type: "taskItem",
                attrs: { checked: false },
                content: [{ type: "paragraph", content: [{ type: "text", text: "Todo" }] }],
              },
            ],
          },
        ],
      };
      const md = exportMarkdown(doc);
      expect(md).toContain("[x] Done");
      expect(md).toContain("[ ] Todo");
    });

    it("should convert tables", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Name" }] }] },
                  { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Age" }] }] },
                ],
              },
              {
                type: "tableRow",
                content: [
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Alice" }] }] },
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "30" }] }] },
                ],
              },
            ],
          },
        ],
      };
      const md = exportMarkdown(doc);
      expect(md).toContain("| Name | Age |");
      expect(md).toContain("| --- | --- |");
      expect(md).toContain("| Alice | 30 |");
    });

    it("should escape pipe characters in table cells", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Col|1" }] }] },
                ],
              },
              {
                type: "tableRow",
                content: [
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "data|here" }] }] },
                ],
              },
            ],
          },
        ],
      };
      const md = exportMarkdown(doc);
      expect(md).toContain("Col\\|1");
      expect(md).toContain("data\\|here");
    });
  });

  describe("exportMarkdownFromString", () => {
    it("should parse and export valid JSON", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        ],
      };
      const md = exportMarkdownFromString(JSON.stringify(doc));
      expect(md).toBe("Hello");
    });

    it("should return raw string for invalid JSON", () => {
      const md = exportMarkdownFromString("not json");
      expect(md).toBe("not json");
    });
  });

  describe("exportMarkdownWithTitle", () => {
    it("should prepend title as heading", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Content" }] },
        ],
      };
      const md = exportMarkdownWithTitle("Page Title", doc);
      expect(md).toBe("# Page Title\n\nContent");
    });
  });
});
