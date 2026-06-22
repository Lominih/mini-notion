import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { importMarkdown, importMarkdownWithTitle } from "@/server/services/import-markdown";
import { importHtml, importHtmlWithTitle } from "@/server/services/import-html";
import { exportMarkdown, exportMarkdownWithTitle } from "@/server/services/export-markdown";
import { exportToHtml, exportPdfHtml } from "@/server/services/export-pdf";
import { getNextOrder } from "@/server/services/page-tree";
import type { TipTapDoc } from "@/lib/serializer";

/**
 * tRPC router for import/export operations.
 *
 * Provides endpoints for:
 *  - Markdown import (text → page)
 *  - HTML import (text → page)
 *  - Markdown export (page → text)
 *  - HTML export (page → text)
 *  - PDF export (page → HTML stub)
 *  - Batch import (multiple pages)
 */

export const ioRouter = router({
  /**
   * Import a Markdown string as a new page.
   */
  importMarkdown: workspaceProcedure
    .input(
      z.object({
        markdown: z.string().min(1).max(1_000_000),
        title: z.string().min(1).max(500).optional(),
        parentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { doc, title: extractedTitle } = importMarkdownWithTitle(input.markdown);
      const title = input.title ?? extractedTitle;

      if (input.parentId) {
        const parent = await ctx.db.page.findFirst({
          where: { id: input.parentId, workspaceId: ctx.workspaceId },
        });
        if (!parent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent page not found in this workspace.",
          });
        }
      }

      const order = await getNextOrder(input.parentId ?? null, ctx.workspaceId);

      const page = await ctx.db.page.create({
        data: {
          title,
          content: JSON.stringify(doc),
          workspaceId: ctx.workspaceId,
          parentId: input.parentId ?? null,
          order,
        },
        include: {
          tags: true,
          parent: { select: { id: true, title: true, icon: true } },
          children: { select: { id: true, title: true, icon: true } },
        },
      });

      return page;
    }),

  /**
   * Import an HTML string as a new page.
   */
  importHtml: workspaceProcedure
    .input(
      z.object({
        html: z.string().min(1).max(5_000_000),
        title: z.string().min(1).max(500).optional(),
        parentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { doc, title: extractedTitle } = importHtmlWithTitle(input.html);
      const title = input.title ?? extractedTitle;

      if (input.parentId) {
        const parent = await ctx.db.page.findFirst({
          where: { id: input.parentId, workspaceId: ctx.workspaceId },
        });
        if (!parent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent page not found in this workspace.",
          });
        }
      }

      const order = await getNextOrder(input.parentId ?? null, ctx.workspaceId);

      const page = await ctx.db.page.create({
        data: {
          title,
          content: JSON.stringify(doc),
          workspaceId: ctx.workspaceId,
          parentId: input.parentId ?? null,
          order,
        },
        include: {
          tags: true,
          parent: { select: { id: true, title: true, icon: true } },
          children: { select: { id: true, title: true, icon: true } },
        },
      });

      return page;
    }),

  /**
   * Export a page as Markdown.
   */
  exportMarkdown: workspaceProcedure
    .input(z.object({ pageId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.page.findFirst({
        where: { id: input.pageId, workspaceId: ctx.workspaceId },
      });

      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
      }

      let doc: TipTapDoc;
      try {
        doc = typeof page.content === "string"
          ? JSON.parse(page.content)
          : (page.content as unknown as TipTapDoc) ?? { type: "doc", content: [] };
      } catch {
        doc = { type: "doc", content: [] };
      }

      const markdown = exportMarkdownWithTitle(page.title, doc);

      return { markdown, title: page.title };
    }),

  /**
   * Export a page as HTML.
   */
  exportHtml: workspaceProcedure
    .input(z.object({ pageId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.page.findFirst({
        where: { id: input.pageId, workspaceId: ctx.workspaceId },
      });

      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
      }

      let doc: TipTapDoc;
      try {
        doc = typeof page.content === "string"
          ? JSON.parse(page.content)
          : (page.content as unknown as TipTapDoc) ?? { type: "doc", content: [] };
      } catch {
        doc = { type: "doc", content: [] };
      }

      const html = exportToHtml(page.title, doc);

      return { html, title: page.title };
    }),

  /**
   * Export a page as PDF (stub).
   * Returns the PDF-ready HTML. Actual PDF generation requires
   * a headless browser (Puppeteer/Playwright) at runtime.
   */
  exportPdf: workspaceProcedure
    .input(z.object({ pageId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.page.findFirst({
        where: { id: input.pageId, workspaceId: ctx.workspaceId },
      });

      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
      }

      let doc: TipTapDoc;
      try {
        doc = typeof page.content === "string"
          ? JSON.parse(page.content)
          : (page.content as unknown as TipTapDoc) ?? { type: "doc", content: [] };
      } catch {
        doc = { type: "doc", content: [] };
      }

      const pdfHtml = exportPdfHtml(page.title, doc);

      return {
        html: pdfHtml,
        title: page.title,
        message: "PDF export requires a headless browser. The HTML content is ready for rendering.",
      };
    }),

  /**
   * Batch import multiple Markdown documents as pages.
   */
  batchImport: workspaceProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({
              markdown: z.string().min(1).max(1_000_000),
              title: z.string().min(1).max(500).optional(),
              parentId: z.string().uuid().nullable().optional(),
            }),
          )
          .min(1)
          .max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results: {
        id: string;
        title: string;
        success: boolean;
        error?: string;
      }[] = [];

      for (const item of input.items) {
        try {
          const { doc, title: extractedTitle } = importMarkdownWithTitle(item.markdown);
          const title = item.title ?? extractedTitle;

          if (item.parentId) {
            const parent = await ctx.db.page.findFirst({
              where: { id: item.parentId, workspaceId: ctx.workspaceId },
            });
            if (!parent) {
              results.push({
                id: "",
                title,
                success: false,
                error: "Parent page not found",
              });
              continue;
            }
          }

          const order = await getNextOrder(item.parentId ?? null, ctx.workspaceId);

          const page = await ctx.db.page.create({
            data: {
              title,
              content: JSON.stringify(doc),
              workspaceId: ctx.workspaceId,
              parentId: item.parentId ?? null,
              order,
            },
          });

          results.push({ id: page.id, title: page.title, success: true });
        } catch (err) {
          results.push({
            id: "",
            title: item.title ?? "Untitled",
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      return {
        imported: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };
    }),
});
