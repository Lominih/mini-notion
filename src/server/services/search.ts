import { db } from '@/server/db';
import type { Page } from "@prisma/client";

export interface SearchResult {
  page: Page;
  score: number;
  matchedTitle: boolean;
  matchedContent: boolean;
  highlights: SearchHighlight[];
}

export interface SearchHighlight {
  field: 'title' | 'content';
  snippet: string;
}

export interface SearchFilters {
  workspaceId: string;
  query: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract plain text from a JSON content string (array of TipTap/ProseMirror blocks).
 */
function extractTextFromContent(content: string): string {
  try {
    const blocks = JSON.parse(content);
    if (!Array.isArray(blocks)) return '';

    const extractFromNode = (node: Record<string, unknown>): string => {
      const texts: string[] = [];
      if (typeof node.text === 'string') {
        texts.push(node.text);
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) {
          texts.push(extractFromNode(child as Record<string, unknown>));
        }
      }
      return texts.join(' ');
    };

    return blocks.map((block: Record<string, unknown>) => extractFromNode(block)).join(' ');
  } catch {
    // If content is not valid JSON, treat as plain text
    return content;
  }
}

/**
 * Highlight matching terms in text by wrapping them in markers.
 */
function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;

  const terms = query
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegex);

  if (terms.length === 0) return text;

  const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
  return text.replace(pattern, '<<<$1>>>');
}

/**
 * Create a snippet around the first match in text.
 */
function createSnippet(text: string, query: string, maxLength = 200): string {
  if (!query.trim()) return text.slice(0, maxLength);

  const terms = query.split(/\s+/).filter(Boolean);
  const lowerText = text.toLowerCase();

  // Find the first occurrence of any search term
  let firstIndex = -1;
  for (const term of terms) {
    const idx = lowerText.indexOf(term.toLowerCase());
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx;
    }
  }

  if (firstIndex === -1) return text.slice(0, maxLength);

  // Center the snippet around the match
  const start = Math.max(0, firstIndex - Math.floor(maxLength / 3));
  const end = Math.min(text.length, start + maxLength);
  let snippet = text.slice(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Perform full-text search across pages in a workspace.
 *
 * Relevance scoring:
 * - Title match: 10 points per term
 * - Content match: 1 point per term
 * - Exact title match bonus: 50 points
 * - Recent update bonus: up to 5 points (decays over 30 days)
 */
export async function searchPages(filters: SearchFilters): Promise<SearchResult[]> {
  const { workspaceId, query, tags, createdAfter, createdBefore, updatedAfter, updatedBefore } =
    filters;

  if (!query.trim()) return [];

  const terms = query
    .split(/\s+/)
    .filter((t) => t.length > 0);

  // Build the WHERE conditions for Prisma
  const titleConditions = terms.map((term) => ({
    title: { contains: term },
  }));

  const contentConditions = terms.map((term) => ({
    content: { contains: term },
  }));

  const where: Record<string, unknown> = {
    workspaceId,
    OR: [
      { AND: titleConditions },
      { AND: contentConditions },
    ],
  };

  if (createdAfter || createdBefore) {
    where.createdAt = {
      ...(createdAfter && { gte: createdAfter }),
      ...(createdBefore && { lte: createdBefore }),
    };
  }

  if (updatedAfter || updatedBefore) {
    where.updatedAt = {
      ...(updatedAfter && { gte: updatedAfter }),
      ...(updatedBefore && { lte: updatedBefore }),
    };
  }

  // If tag filter is specified, we need to find pages with those tags
  let filteredPageIds: string[] | null = null;
  if (tags && tags.length > 0) {
    const taggedPages = await db.pageTag.findMany({
      where: {
        name: { in: tags },
        page: { workspaceId },
      },
      select: { pageId: true },
      distinct: ['pageId'],
    });

    filteredPageIds = taggedPages.map((t) => t.pageId);
    if (filteredPageIds.length === 0) return [];
    where.id = { in: filteredPageIds };
  }

  const pages = await db.page.findMany({
    where: where as never,
    take: 100,
  });

  // Score and rank results
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  const results: SearchResult[] = pages.map((page) => {
    let score = 0;
    let matchedTitle = false;
    let matchedContent = false;
    const highlights: SearchHighlight[] = [];

    const lowerTitle = page.title.toLowerCase();
    const contentText = extractTextFromContent(page.content);
    const lowerContent = contentText.toLowerCase();

    // Score title matches (weighted much higher than content)
    for (const term of terms) {
      const lowerTerm = term.toLowerCase();
      if (lowerTitle.includes(lowerTerm)) {
        score += 100;
        matchedTitle = true;
        // Bonus: title starts with the search term
        if (lowerTitle.startsWith(lowerTerm)) {
          score += 50;
        }
      }
      if (lowerContent.includes(lowerTerm)) {
        score += 1;
        matchedContent = true;
      }
    }

    // Exact title match bonus
    if (lowerTitle === query.toLowerCase()) {
      score += 500;
    } else if (terms.some((t) => lowerTitle.includes(t.toLowerCase()))) {
      score += 50;
    }

    // Recency bonus (decays linearly over 30 days)
    const ageMs = now - page.updatedAt.getTime();
    const recencyBonus = Math.max(0, 5 * (1 - ageMs / thirtyDaysMs));
    score += recencyBonus;

    // Build highlights
    if (matchedTitle) {
      highlights.push({
        field: 'title',
        snippet: highlightText(page.title, query),
      });
    }

    if (matchedContent) {
      highlights.push({
        field: 'content',
        snippet: highlightText(createSnippet(contentText, query), query),
      });
    }

    return { page, score, matchedTitle, matchedContent, highlights };
  });

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}
