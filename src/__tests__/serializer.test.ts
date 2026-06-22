import { describe, it, expect } from "vitest";
import {
  markdownToTipTap,
  tiptapToMarkdown,
  plainTextToBlocks,
  jsonToDocument,
  documentToJSON,
  emptyDocument,
  type TipTapDoc,
} from "@/lib/serializer";

/**
 * Unit tests for the TipTap content serializer.
 * Tests Markdown ↔ TipTap JSON conversion.
 */

describe("serializer", () => {
  describe("markdownToTipTap", () => {
    it("should parse a simple paragraph", () => {
      const doc = markdownToTipTap("Hello world");
      expect(doc.type).toBe("doc");
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("paragraph");
    });

    it("should parse headings at all levels", () => {
      const md = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";
      const doc = markdownToTipTap(md);

      expect(doc.content).toHaveLength(6);
      doc.content.forEach((node, i) => {
        expect(node.type).toBe("heading");
        expect(node.attrs?.level).toBe(i + 1);
      });
    });

    it("should parse bold and italic text", () => {
      const doc = markdownToTipTap("**bold** and *italic*");
      const para = doc.content[0];
      expect(para.type).toBe("paragraph");
      expect(para.content).toBeDefined();
      // Should have text nodes with marks
      const marks = para.content!.flatMap((n) => n.marks ?? []);
      expect(marks.some((m) => m.type === "bold")).toBe(true);
      expect(marks.some((m) => m.type === "italic")).toBe(true);
    });

    it("should parse inline code", () => {
      const doc = markdownToTipTap("Use `console.log()` for debugging");
      const para = doc.content[0];
      const marks = para.content!.flatMap((n) => n.marks ?? []);
      expect(marks.some((m) => m.type === "code")).toBe(true);
    });

    it("should parse links", () => {
      const doc = markdownToTipTap("[Click here](https://example.com)");
      const para = doc.content[0];
      const linkMark = para.content!.flatMap((n) => n.marks ?? []).find((m) => m.type === "link");
      expect(linkMark).toBeDefined();
      expect(linkMark?.attrs?.href).toBe("https://example.com");
    });

    it("should parse bullet lists", () => {
      const md = "- Item 1\n- Item 2\n- Item 3";
      const doc = markdownToTipTap(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("bulletList");
      expect(doc.content[0].content).toHaveLength(3);
    });

    it("should parse ordered lists", () => {
      const md = "1. First\n2. Second\n3. Third";
      const doc = markdownToTipTap(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("orderedList");
      expect(doc.content[0].content).toHaveLength(3);
    });

    it("should parse code blocks with language", () => {
      const md = "```typescript\nconst x = 1;\n```";
      const doc = markdownToTipTap(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("codeBlock");
      expect(doc.content[0].attrs?.language).toBe("typescript");
    });

    it("should parse blockquotes", () => {
      const md = "> This is a quote";
      const doc = markdownToTipTap(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("blockquote");
    });

    it("should parse horizontal rules", () => {
      const md = "---";
      const doc = markdownToTipTap(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("horizontalRule");
    });

    it("should parse images", () => {
      const md = "![alt text](https://example.com/image.png)";
      const doc = markdownToTipTap(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("image");
      expect(doc.content[0].attrs?.src).toBe("https://example.com/image.png");
      expect(doc.content[0].attrs?.alt).toBe("alt text");
    });

    it("should parse task lists", () => {
      const md = "- [x] Done\n- [ ] Todo";
      const doc = markdownToTipTap(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("taskList");
      expect(doc.content[0].content).toHaveLength(2);
      expect(doc.content[0].content![0].attrs?.checked).toBe(true);
      expect(doc.content[0].content![1].attrs?.checked).toBe(false);
    });

    it("should parse tables", () => {
      const md = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";
      const doc = markdownToTipTap(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("table");
      expect(doc.content[0].content).toHaveLength(3); // header + 2 rows
    });
  });

  describe("tiptapToMarkdown", () => {
    it("should convert a doc with paragraphs", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      };

      const md = tiptapToMarkdown(doc);
      expect(md).toBe("Hello world");
    });

    it("should convert headings", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Section" }],
          },
        ],
      };

      const md = tiptapToMarkdown(doc);
      expect(md).toContain("## Section");
    });

    it("should convert bold marks", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "bold", marks: [{ type: "bold" }] }],
          },
        ],
      };

      const md = tiptapToMarkdown(doc);
      expect(md).toContain("**bold**");
    });

    it("should convert code blocks", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "js" },
            content: [{ type: "text", text: "console.log('hi');" }],
          },
        ],
      };

      const md = tiptapToMarkdown(doc);
      expect(md).toContain("```js");
      expect(md).toContain("console.log('hi');");
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

      const md = tiptapToMarkdown(doc);
      expect(md).toContain("> A quote");
    });

    it("should convert horizontal rules", () => {
      const doc: TipTapDoc = {
        type: "doc",
        content: [{ type: "horizontalRule" }],
      };

      const md = tiptapToMarkdown(doc);
      expect(md).toContain("---");
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

      const md = tiptapToMarkdown(doc);
      expect(md).toContain("![photo](https://example.com/img.png)");
    });

    it("should convert task items", () => {
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

      const md = tiptapToMarkdown(doc);
      expect(md).toContain("[x] Done");
      expect(md).toContain("[ ] Todo");
    });
  });

  describe("roundtrip: markdown → blocks → markdown", () => {
    it("should preserve headings", () => {
      const input = "# Title";
      const doc = markdownToTipTap(input);
      const output = tiptapToMarkdown(doc);
      expect(output).toContain("# Title");
    });

    it("should preserve code blocks", () => {
      const input = "```python\nprint('hello')\n```";
      const doc = markdownToTipTap(input);
      const output = tiptapToMarkdown(doc);
      expect(output).toContain("```");
      expect(output).toContain("print('hello')");
    });

    it("should preserve bullet lists", () => {
      const input = "- One\n- Two\n- Three";
      const doc = markdownToTipTap(input);
      const output = tiptapToMarkdown(doc);
      expect(output).toContain("- One");
      expect(output).toContain("- Two");
      expect(output).toContain("- Three");
    });
  });

  describe("plainTextToBlocks", () => {
    it("should convert plain text to paragraphs", () => {
      const doc = plainTextToBlocks("Hello\nWorld");
      expect(doc.content).toHaveLength(2);
      expect(doc.content[0].type).toBe("paragraph");
      expect(doc.content[1].type).toBe("paragraph");
    });

    it("should detect markdown headings in plain text", () => {
      const doc = plainTextToBlocks("# Heading 1\nNormal text");
      expect(doc.content[0].type).toBe("heading");
      expect(doc.content[0].attrs?.level).toBe(1);
    });

    it("should skip empty lines", () => {
      const doc = plainTextToBlocks("Line 1\n\n\nLine 2");
      expect(doc.content).toHaveLength(2);
    });
  });

  describe("helpers", () => {
    it("emptyDocument should return minimal doc", () => {
      const doc = emptyDocument();
      expect(doc.type).toBe("doc");
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("paragraph");
    });

    it("documentToJSON should serialize to JSON string", () => {
      const doc = emptyDocument();
      const json = documentToJSON(doc);
      expect(typeof json).toBe("string");
      expect(JSON.parse(json)).toEqual(doc);
    });

    it("jsonToDocument should parse valid JSON", () => {
      const doc = emptyDocument();
      const json = JSON.stringify(doc);
      const parsed = jsonToDocument(json);
      expect(parsed).toEqual(doc);
    });

    it("jsonToDocument should handle invalid JSON gracefully", () => {
      const doc = jsonToDocument("not valid json");
      expect(doc.type).toBe("doc");
    });
  });
});
