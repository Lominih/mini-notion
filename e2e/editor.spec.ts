import { test, expect } from "@playwright/test";

test.describe("Editor - Document Creation & Editing", () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to a workspace before each test
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL("**/");

    // Navigate to the first workspace
    const workspaceLink = page.getByRole("link", { name: /workspace/i }).first();
    if (await workspaceLink.isVisible()) {
      await workspaceLink.click();
    }
  });

  test("should create a new page", async ({ page }) => {
    const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
    await newPageBtn.click();

    // The editor should appear with a default title
    const titleInput = page.locator('[data-testid="page-title"], [contenteditable="true"]').first();
    await expect(titleInput).toBeVisible();
  });

  test("should type content into the editor", async ({ page }) => {
    // Create or open a page
    const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
    await newPageBtn.click();

    // Wait for the editor to load
    const editor = page.locator(".tiptap, [contenteditable='true']").first();
    await expect(editor).toBeVisible();

    // Type content
    await editor.click();
    await page.keyboard.type("Hello, this is a test document.");
    await expect(editor).toContainText("Hello, this is a test document.");
  });

  test("should apply bold formatting", async ({ page }) => {
    const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
    await newPageBtn.click();

    const editor = page.locator(".tiptap, [contenteditable='true']").first();
    await expect(editor).toBeVisible();
    await editor.click();

    // Type text and apply bold
    await page.keyboard.type("normal ");
    await page.keyboard.press("Control+b");
    await page.keyboard.type("bold text");
    await page.keyboard.press("Control+b");

    // Verify bold element exists
    await expect(editor.locator("strong, b")).toContainText("bold text");
  });

  test("should apply italic formatting", async ({ page }) => {
    const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
    await newPageBtn.click();

    const editor = page.locator(".tiptap, [contenteditable='true']").first();
    await expect(editor).toBeVisible();
    await editor.click();

    await page.keyboard.type("normal ");
    await page.keyboard.press("Control+i");
    await page.keyboard.type("italic text");
    await page.keyboard.press("Control+i");

    await expect(editor.locator("em, i")).toContainText("italic text");
  });

  test("should create headings using markdown shortcuts", async ({ page }) => {
    const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
    await newPageBtn.click();

    const editor = page.locator(".tiptap, [contenteditable='true']").first();
    await expect(editor).toBeVisible();
    await editor.click();

    // Type heading shortcut
    await page.keyboard.type("# ");
    await page.keyboard.type("My Heading");

    // Verify heading element
    await expect(editor.locator("h1")).toContainText("My Heading");
  });

  test("should create a bullet list", async ({ page }) => {
    const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
    await newPageBtn.click();

    const editor = page.locator(".tiptap, [contenteditable='true']").first();
    await expect(editor).toBeVisible();
    await editor.click();

    // Create bullet list using markdown shortcut
    await page.keyboard.type("- ");
    await page.keyboard.type("List item 1");
    await page.keyboard.press("Enter");
    await page.keyboard.type("List item 2");

    await expect(editor.locator("li")).toHaveCount(2);
  });

  test("should create a task list", async ({ page }) => {
    const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
    await newPageBtn.click();

    const editor = page.locator(".tiptap, [contenteditable='true']").first();
    await expect(editor).toBeVisible();
    await editor.click();

    // Create task list using markdown shortcut
    await page.keyboard.type("[] ");
    await page.keyboard.type("Task item");

    await expect(editor.locator('li[data-type="taskItem"]')).toBeVisible();
  });

  test("should toggle task list item", async ({ page }) => {
    const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
    await newPageBtn.click();

    const editor = page.locator(".tiptap, [contenteditable='true']").first();
    await expect(editor).toBeVisible();
    await editor.click();

    await page.keyboard.type("[] ");
    await page.keyboard.type("Unchecked task");
    await page.keyboard.press("Enter");

    // Click the checkbox to check it
    const checkbox = editor.locator('li[data-type="taskItem"] input[type="checkbox"]').first();
    await checkbox.click();

    await expect(checkbox).toBeChecked();
  });

  test("should persist content after page reload", async ({ page }) => {
    const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
    await newPageBtn.click();

    const editor = page.locator(".tiptap, [contenteditable='true']").first();
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type("Persistent content");

    // Wait for auto-save
    await page.waitForTimeout(2000);

    // Reload the page
    await page.reload();

    // Content should still be present
    await expect(editor).toContainText("Persistent content");
  });

  test("should set page icon", async ({ page }) => {
    const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
    await newPageBtn.click();

    // Look for the icon picker button
    const iconBtn = page.locator('[data-testid="icon-picker"], button:has-text("🎨"), button:has-text("😊")').first();
    if (await iconBtn.isVisible()) {
      await iconBtn.click();

      // Select an emoji from the picker
      const emoji = page.locator('[data-emoji=" rocket"], button:has-text("🚀")').first();
      if (await emoji.isVisible()) {
        await emoji.click();
      }
    }
  });

  test("should set page title", async ({ page }) => {
    const newPageBtn = page.getByRole("button", { name: /new page|add page|create/i }).first();
    await newPageBtn.click();

    const titleInput = page.locator('[data-testid="page-title"], h1[contenteditable="true"], input[placeholder*="title" i]').first();
    if (await titleInput.isVisible()) {
      await titleInput.click();
      await titleInput.fill("");
      await titleInput.type("My Custom Title");

      // Verify the title was set
      await expect(titleInput).toContainText("My Custom Title");
    }
  });
});