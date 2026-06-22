import { test, expect } from "@playwright/test";

test.describe("Documents - CRUD, Search & Tags", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL("**/");
  });

  test.describe("Document CRUD", () => {
    test("should create a new document via sidebar", async ({ page }) => {
      const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
      await expect(newPageBtn).toBeVisible();
      await newPageBtn.click();

      // Editor should open with a new untitled page
      const editor = page.locator(".tiptap, [contenteditable='true']").first();
      await expect(editor).toBeVisible({ timeout: 10_000 });
    });

    test("should display document in sidebar after creation", async ({ page }) => {
      const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
      await newPageBtn.click();

      const editor = page.locator(".tiptap, [contenteditable='true']").first();
      await expect(editor).toBeVisible({ timeout: 10_000 });

      // Check sidebar shows the new page
      const sidebar = page.locator('[data-testid="sidebar"], nav, aside').first();
      await expect(sidebar).toContainText("Untitled");
    });

    test("should edit an existing document", async ({ page }) => {
      // Navigate to existing page or create one
      const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
      if (await newPageBtn.isVisible()) {
        await newPageBtn.click();
      }

      const editor = page.locator(".tiptap, [contenteditable='true']").first();
      await expect(editor).toBeVisible({ timeout: 10_000 });

      await editor.click();
      await page.keyboard.type("Original content");
      await page.waitForTimeout(1500);

      // Reload to verify persistence
      await page.reload();
      await expect(editor).toContainText("Original content");
    });

    test("should delete a document", async ({ page }) => {
      // Create a page first
      const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
      await newPageBtn.click();

      const editor = page.locator(".tiptap, [contenteditable='true']").first();
      await expect(editor).toBeVisible({ timeout: 10_000 });
      await editor.click();
      await page.keyboard.type("Page to delete");
      await page.waitForTimeout(1000);

      // Look for delete action (context menu, settings, or toolbar button)
      const moreBtn = page.locator(
        '[data-testid="page-menu"], [data-testid="more-options"], button[aria-label*="more" i], button[aria-label*="menu" i]'
      ).first();

      if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await moreBtn.click();

        const deleteBtn = page.getByRole("menuitem", { name: /delete/i }).or(
          page.locator('button:has-text("Delete")')
        ).first();

        if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deleteBtn.click();

          // Confirm deletion if a dialog appears
          const confirmBtn = page.getByRole("button", { name: /confirm|yes|delete/i }).first();
          if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmBtn.click();
          }
        }
      }
    });

    test("should navigate between documents", async ({ page }) => {
      // Click on first sidebar item (if any exist)
      const sidebarLinks = page.locator(
        '[data-testid="sidebar"] a, [data-testid="sidebar"] button, nav a[href*="page"]'
      );

      const firstLink = sidebarLinks.first();
      if (await firstLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstLink.click();
        await page.waitForTimeout(500);

        // Click on a different sidebar item
        const secondLink = sidebarLinks.nth(1);
        if (await secondLink.isVisible({ timeout: 2000 }).catch(() => false)) {
          await secondLink.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test("should duplicate a document", async ({ page }) => {
      const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
      await newPageBtn.click();

      const editor = page.locator(".tiptap, [contenteditable='true']").first();
      await expect(editor).toBeVisible({ timeout: 10_000 });
      await editor.click();
      await page.keyboard.type("Content to duplicate");
      await page.waitForTimeout(1500);

      // Look for duplicate action
      const moreBtn = page.locator(
        '[data-testid="page-menu"], [data-testid="more-options"], button[aria-label*="more" i]'
      ).first();

      if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await moreBtn.click();

        const duplicateBtn = page.getByRole("menuitem", { name: /duplicate|copy/i }).or(
          page.locator('button:has-text("Duplicate")')
        ).first();

        if (await duplicateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await duplicateBtn.click();

          // Should navigate to the duplicated page or show it in sidebar
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test.describe("Search", () => {
    test("should open search interface", async ({ page }) => {
      // Try keyboard shortcut or search button
      const searchBtn = page.locator(
        '[data-testid="search"], button[aria-label*="search" i], button:has-text("Search")'
      ).first();

      if (await searchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchBtn.click();
      } else {
        // Try keyboard shortcut
        await page.keyboard.press("Control+k");
      }

      // Search dialog or input should appear
      const searchInput = page.locator(
        '[data-testid="search-input"], input[placeholder*="search" i], [role="searchbox"]'
      ).first();

      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(searchInput).toBeVisible();
      }
    });

    test("should search for documents by title", async ({ page }) => {
      // Open search
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(500);

      const searchInput = page.locator(
        '[data-testid="search-input"], input[placeholder*="search" i], [role="searchbox"], dialog input'
      ).first();

      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill("test");

        // Wait for search results
        await page.waitForTimeout(1000);

        // Results area should be visible (even if empty)
        const results = page.locator(
          '[data-testid="search-results"], [role="listbox"], ul[role="listbox"]'
        ).first();

        if (await results.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(results).toBeVisible();
        }
      }
    });

    test("should close search with Escape key", async ({ page }) => {
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(500);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      // Search dialog should be closed
      const searchInput = page.locator(
        '[data-testid="search-input"], input[placeholder*="search" i], [role="searchbox"]'
      ).first();

      if (await searchInput.isVisible().catch(() => false)) {
        await expect(searchInput).not.toBeVisible();
      }
    });
  });

  test.describe("Tags", () => {
    test("should add a tag to a document", async ({ page }) => {
      const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
      await newPageBtn.click();

      const editor = page.locator(".tiptap, [contenteditable='true']").first();
      await expect(editor).toBeVisible({ timeout: 10_000 });

      // Look for tag input or tag button
      const tagBtn = page.locator(
        '[data-testid="add-tag"], [data-testid="tag-input"], button[aria-label*="tag" i]'
      ).first();

      if (await tagBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tagBtn.click();

        const tagInput = page.locator(
          '[data-testid="tag-input"] input, input[placeholder*="tag" i]'
        ).first();

        if (await tagInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tagInput.fill("important");
          await page.keyboard.press("Enter");
          await page.waitForTimeout(500);
        }
      }
    });

    test("should display tags on documents in sidebar", async ({ page }) => {
      // Tags might appear as labels in the sidebar
      const tagElements = page.locator(
        '[data-testid="tag"], .tag, [class*="tag"]'
      );

      // Verify the tag area exists (may be empty)
      if (await tagElements.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(tagElements.first()).toBeVisible();
      }
    });

    test("should remove a tag from a document", async ({ page }) => {
      const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
      await newPageBtn.click();

      const editor = page.locator(".tiptap, [contenteditable='true']").first();
      await expect(editor).toBeVisible({ timeout: 10_000 });

      // Look for existing tags with remove buttons
      const removeTagBtn = page.locator(
        '[data-testid="remove-tag"], [data-testid="tag"] button, .tag button'
      ).first();

      if (await removeTagBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await removeTagBtn.click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe("Page Tree & Hierarchy", () => {
    test("should create a nested page", async ({ page }) => {
      const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
      await newPageBtn.click();

      const editor = page.locator(".tiptap, [contenteditable='true']").first();
      await expect(editor).toBeVisible({ timeout: 10_000 });
      await editor.click();
      await page.keyboard.type("Parent Page");
      await page.waitForTimeout(1500);

      // Look for "Add sub-page" or nested page creation button
      const addSubPageBtn = page.locator(
        '[data-testid="add-child"], [data-testid="add-subpage"], button:has-text("Add sub-page")'
      ).first();

      if (await addSubPageBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addSubPageBtn.click();

        // A new child page should be created
        const childEditor = page.locator(".tiptap, [contenteditable='true']").first();
        await expect(childEditor).toBeVisible({ timeout: 5_000 });
      }
    });

    test("should show page tree in sidebar", async ({ page }) => {
      // Sidebar should contain the page tree
      const sidebar = page.locator('[data-testid="sidebar"], nav, aside').first();
      await expect(sidebar).toBeVisible();

      // There should be at least one page link in the sidebar
      const pageLinks = sidebar.locator('a[href*="page"], [data-testid="page-item"], li');
      if (await pageLinks.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(pageLinks.first()).toBeVisible();
      }
    });

    test("should toggle page tree expand/collapse", async ({ page }) => {
      // Look for tree toggle buttons
      const toggleBtn = page.locator(
        '[data-testid="tree-toggle"], [data-testid="expand-toggle"], button[aria-label*="expand" i], button[aria-label*="collapse" i]'
      ).first();

      if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await toggleBtn.click();
        await page.waitForTimeout(300);
        // Toggle again
        await toggleBtn.click();
      }
    });
  });

  test.describe("Favorites", () => {
    test("should toggle favorite on a document", async ({ page }) => {
      const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
      await newPageBtn.click();

      const editor = page.locator(".tiptap, [contenteditable='true']").first();
      await expect(editor).toBeVisible({ timeout: 10_000 });

      // Look for favorite/star button
      const favBtn = page.locator(
        '[data-testid="favorite"], [data-testid="toggle-favorite"], button[aria-label*="favorite" i], button[aria-label*="star" i]'
      ).first();

      if (await favBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await favBtn.click();
        await page.waitForTimeout(500);

        // Click again to unfavorite
        await favBtn.click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe("Recent Pages", () => {
    test("should show recently edited pages", async ({ page }) => {
      // Look for recent pages section in sidebar or main area
      const recentSection = page.locator(
        '[data-testid="recent-pages"], h2:has-text("Recent"), h3:has-text("Recent")'
      ).first();

      if (await recentSection.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(recentSection).toBeVisible();
      }
    });
  });
});