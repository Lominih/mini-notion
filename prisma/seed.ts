import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seed script: populates the database with demo data for development.
 *
 * Usage:
 *   npx prisma db seed
 *
 * Creates:
 *   - 2 users (admin + member)
 *   - 1 workspace with membership
 *   - Sample pages with various content types
 *   - Tags and comments
 */

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Users ──────────────────────────────────────────────────

  const adminPassword = await bcrypt.hash("admin123", 12);
  const memberPassword = await bcrypt.hash("member123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin User",
      password: adminPassword,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@example.com" },
    update: {},
    create: {
      email: "member@example.com",
      name: "Team Member",
      password: memberPassword,
    },
  });

  console.log(`  ✓ Users created: ${admin.email}, ${member.email}`);

  // ── Workspace ──────────────────────────────────────────────

  const workspace = await prisma.workspace.create({
    data: {
      name: "Mini Notion Demo",
      icon: "🚀",
      ownerId: admin.id,
      members: {
        create: [
          { userId: admin.id, role: "OWNER" },
          { userId: member.id, role: "MEMBER" },
        ],
      },
    },
  });

  console.log(`  ✓ Workspace created: ${workspace.name}`);

  // ── Pages ──────────────────────────────────────────────────

  const welcomePage = await prisma.page.create({
    data: {
      title: "Welcome to Mini Notion",
      icon: "👋",
      content: JSON.stringify([
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Welcome to Mini Notion!" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This is your collaborative workspace. You can create pages, organize them in a tree, and work together in real-time.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Features" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Rich text editing with " },
                    { type: "text", text: "TipTap", marks: [{ type: "bold" }] },
                  ],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Real-time collaboration with Yjs" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Page tree with nested organization" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Import & Export (Markdown, HTML, PDF)" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Comments and version history" }],
                },
              ],
            },
          ],
        },
      ]),
      workspaceId: workspace.id,
      createdById: admin.id,
      order: 0,
    },
  });

  const gettingStarted = await prisma.page.create({
    data: {
      title: "Getting Started",
      icon: "📖",
      content: JSON.stringify([
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Getting Started" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Quick Start" }],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Create a new page using the sidebar" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Use the slash menu for block types" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Invite team members to collaborate" }],
                },
              ],
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Keyboard Shortcuts" }],
        },
        {
          type: "codeBlock",
          attrs: { language: "text" },
          content: [
            {
              type: "text",
              text: "Ctrl+B  - Bold\nCtrl+I  - Italic\nCtrl+E  - Inline code\n/       - Open slash menu",
            },
          ],
        },
      ]),
      workspaceId: workspace.id,
      createdById: admin.id,
      order: 1,
    },
  });

  const taskPage = await prisma.page.create({
    data: {
      title: "Project Tasks",
      icon: "✅",
      content: JSON.stringify([
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Project Tasks" }],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Set up project repository" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Configure database and Prisma" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Build rich text editor" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Add real-time collaboration" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Implement import/export features" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Write comprehensive tests" }],
                },
              ],
            },
          ],
        },
      ]),
      workspaceId: workspace.id,
      createdById: admin.id,
      order: 2,
    },
  });

  const apiPage = await prisma.page.create({
    data: {
      title: "API Reference",
      icon: "🔌",
      content: JSON.stringify([
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "API Reference" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Mini Notion uses tRPC for type-safe API endpoints." }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Endpoints" }],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Router" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Description" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Auth" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "page" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "CRUD operations for pages" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Required" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "io" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Import/Export operations" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Required" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "comment" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Page comments" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Required" }] }] },
              ],
            },
          ],
        },
      ]),
      workspaceId: workspace.id,
      createdById: admin.id,
      parentId: gettingStarted.id,
      order: 0,
    },
  });

  // Nest Getting Started under Welcome
  await prisma.page.update({
    where: { id: gettingStarted.id },
    data: { parentId: welcomePage.id },
  });

  console.log(`  ✓ Pages created: ${welcomePage.title}, ${gettingStarted.title}, ${taskPage.title}, ${apiPage.title}`);

  // ── Tags ───────────────────────────────────────────────────

  await prisma.pageTag.createMany({
    data: [
      { pageId: welcomePage.id, name: "onboarding" },
      { pageId: welcomePage.id, name: "important" },
      { pageId: gettingStarted.id, name: "tutorial" },
      { pageId: taskPage.id, name: "tasks" },
      { pageId: taskPage.id, name: "important" },
      { pageId: apiPage.id, name: "reference" },
    ],
  });

  console.log("  ✓ Tags assigned");

  // ── Comments ───────────────────────────────────────────────

  await prisma.comment.create({
    data: {
      pageId: welcomePage.id,
      authorId: member.id,
      content: "Great introduction! Maybe add a section about keyboard shortcuts?",
    },
  });

  await prisma.comment.create({
    data: {
      pageId: taskPage.id,
      authorId: admin.id,
      content: "Let's prioritize the collaboration feature next sprint.",
    },
  });

  console.log("  ✓ Comments created");

  // ── Invitations ────────────────────────────────────────────

  await prisma.invitation.create({
    data: {
      email: "newbie@example.com",
      role: "MEMBER",
      workspaceId: workspace.id,
      token: "demo-invite-token-abc123",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("  ✓ Invitation created");

  console.log("\n🎉 Seed complete!\n");
  console.log("  Admin:    admin@example.com / admin123");
  console.log("  Member:   member@example.com / member123");
  console.log("");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
