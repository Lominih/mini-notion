import { describe, it, expect } from "vitest";
import { importMarkdown, importMarkdownWithTitle } from "@/server/services/import-markdown";

/**
 * Unit tests for the Markdown import service.
 * Tests conversion of Markdown text to TipTap JSON blocks.
 */

describe("import-markdown service", () => {
  describe("importMarkdown", () => {
    it("should parse simple paragraphs", () => {
      const doc = importMarkdown("Hello world\n\nSecond paragraph");
      expect(doc.type).toBe("doc");
      expect(doc.content).toHaveLength(2);
      expect(doc.content[0].type).toBe("paragraph");
      expect(doc.content[1].type).toBe("paragraph");
    });

    it("should parse all heading levels", () => {
      const md = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";
      const doc = importMarkdown(md);

      expect(doc.content).toHaveLength(6);
      for (let i = 0; i < 6; i++) {
        expect(doc.content[i].type).toBe("heading");
        expect(doc.content[i].attrs?.level).toBe(i + 1);
      }
    });

    it("should parse bold text", () => {
      const doc = importMarkdown("**bold text**");
      const text = doc.content[0].content![0];
      expect(text.text).toBe("bold text");
      expect(text.marks).toContainEqual({ type: "bold" });
    });

    it("should parse italic text", () => {
      const doc = importMarkdown("*italic text*");
      const text = doc.content[0].content![0];
      expect(text.text).toBe("italic text");
      expect(text.marks).toContainEqual({ type: "italic" });
    });

    it("should parse inline code", () => {
      const doc = importMarkdown("`const x = 1`");
      const text = doc.content[0].content![0];
      expect(text.text).toBe("const x = 1");
      expect(text.marks).toContainEqual({ type: "code" });
    });

    it("should parse strikethrough text", () => {
      const doc = importMarkdown("~~deleted~~");
      const text = doc.content[0].content![0];
      expect(text.text).toBe("deleted");
      expect(text.marks).toContainEqual({ type: "strike" });
    });

    it("should parse links", () => {
      const doc = importMarkdown("[Google](https://google.com)");
      const linkMark = doc.content[0].content![0].marks?.find((m) => m.type === "link");
      expect(linkMark).toBeDefined();
      expect(linkMark?.attrs?.href).toBe("https://google.com");
    });

    it("should parse bullet lists", () => {
      const md = "- Item 1\n- Item 2\n- Item 3";
      const doc = importMarkdown(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("bulletList");
      expect(doc.content[0].content).toHaveLength(3);
    });

    it("should parse ordered lists", () => {
      const md = "1. First\n2. Second\n3. Third";
      const doc = importMarkdown(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("orderedList");
      expect(doc.content[0].content).toHaveLength(3);
    });

    it("should parse code blocks with language", () => {
      const md = "```python\nprint('hello')\n```";
      const doc = importMarkdown(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("codeBlock");
      expect(doc.content[0].attrs?.language).toBe("python");
      expect(doc.content[0].content?.[0].text).toBe("print('hello')");
    });

    it("should parse code blocks without language", () => {
      const md = "```\nsome code\n```";
      const doc = importMarkdown(md);

      expect(doc.content[0].type).toBe("codeBlock");
      expect(doc.content[0].attrs?.language).toBe("plaintext");
    });

    it("should parse blockquotes", () => {
      const md = "> This is a quote\n> Second line";
      const doc = importMarkdown(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("blockquote");
    });

    it("should parse horizontal rules", () => {
      const doc = importMarkdown("---");
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("horizontalRule");
    });

    it("should parse images", () => {
      const md = "![alt text](https://example.com/image.png)";
      const doc = importMarkdown(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("image");
      expect(doc.content[0].attrs?.src).toBe("https://example.com/image.png");
      expect(doc.content[0].attrs?.alt).toBe("alt text");
    });

    it("should parse tables", () => {
      const md = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";
      const doc = importMarkdown(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("table");
      expect(doc.content[0].content).toHaveLength(3); // header + 2 data rows
    });

    it("should parse task lists", () => {
      const md = "- [x] Done task\n- [ ] Pending task";
      const doc = importMarkdown(md);

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("taskList");
      expect(doc.content[0].content).toHaveLength(2);
      expect(doc.content[0].content![0].attrs?.checked).toBe(true);
      expect(doc.content[0].content![1].attrs?.checked).toBe(false);
    });

    it("should handle mixed content", () => {
      const md = `# Title

Some **bold** text here.

- List item 1
- List item 2

\`\`\`js
const x = 1;
\`\`\`

> A blockquote

---

![Image](https://example.com/img.png)`;

      const doc = importMarkdown(md);
      expect(doc.content.length).toBeGreaterThan(5);

      const types = doc.content.map((n) => n.type);
      expect(types).toContain("heading");
      expect(types).toContain("paragraph");
      expect(types).toContain("bulletList");
      expect(types).toContain("codeBlock");
      expect(types).toContain("blockquote");
      expect(types).toContain("horizontalRule");
      expect(types).toContain("image");
    });

    it("should return doc type", () => {
      const doc = importMarkdown("test");
      expect(doc.type).toBe("doc");
    });

    it("should handle empty input", () => {
      const doc = importMarkdown("");
      expect(doc.type).toBe("doc");
      expect(doc.content).toHaveLength(0);
    });
  });

  describe("importMarkdownWithTitle", () => {
    it("should extract title from first heading", () => {
      const md = "# My Page Title\n\nContent here";
      const { title, doc } = importMarkdownWithTitle(md);

      expect(title).toBe("My Page Title");
      expect(doc.content.length).toBeGreaterThan(0);
    });

    it("should fallback to first paragraph text", () => {
      const md = "Just some text without headings";
      const { title } = importMarkdownWithTitle(md);

      expect(title).toBe("Just some text without headings");
    });

    it("should return 'Untitled' for empty content", () => {
      const { title } = importMarkdownWithTitle("");
      expect(title).toBe("Untitled");
    });

    it("should truncate long fallback titles", () => {
      const longText = "A".repeat(300);
      const { title } = importMarkdownWithTitle(longText);
      expect(title.length).toBeLessThanOrEqual(200);
    });
  });
});
