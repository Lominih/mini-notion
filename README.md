# Mini Notion

A lightweight, self-hosted Notion alternative built with Next.js, tRPC, Prisma, and TipTap.

## Features

- **Rich Text Editor** — Block-based editor powered by TipTap with support for headings, lists, code blocks, tables, images, task lists, and more
- **Page Tree** — Organize pages in a nested hierarchy with drag-and-drop reordering
- **Real-Time Collaboration** — Yjs-powered real-time editing with presence indicators and cursor overlays
- **Import & Export** — Import from Markdown and HTML; export to Markdown, HTML, and PDF
- **Comments** — Thread-based comments on pages with resolve/unresolve
- **Version History** — Automatic version snapshots with restore capability
- **Search** — Full-text search across page titles and content with relevance scoring
- **Workspaces** — Multi-workspace support with role-based access control (Owner, Admin, Member, Viewer)
- **Tags** — Tag pages for organization and filtering
- **Templates** — Save and reuse page templates
- **Favorites** — Star frequently accessed pages
- **Auth** — JWT-based authentication with refresh tokens

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TipTap, Tailwind CSS v4 |
| API | tRPC v11, Zod validation |
| Database | SQLite via Prisma 7 |
| Real-Time | Yjs, Socket.IO |
| Auth | Custom JWT + bcryptjs |
| Editor | TipTap with StarterKit + extensions |
| Testing | Vitest |
| Container | Docker |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd mini-notion

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed the database
npx prisma db seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Credentials

After seeding, you can log in with:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | admin123 |
| Member | member@example.com | member123 |

## Docker

### Quick Start

```bash
docker compose up -d
```

### Build Manually

```bash
docker build -t mini-notion .
docker run -p 3000:3000 \
  -e DATABASE_URL="file:./dev.db" \
  -e JWT_SECRET="your-secret" \
  -e NEXTAUTH_SECRET="your-nextauth-secret" \
  mini-notion
```

## Project Structure

```
mini-notion/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Demo data seeder
│   └── config.ts              # Prisma config
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/               # API routes (tRPC, auth)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/            # React components
│   │   ├── collaboration/     # Real-time cursors & presence
│   │   └── editor/            # TipTap editor & block components
│   ├── hooks/                 # React hooks
│   ├── lib/                   # Utilities & config
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── serializer.ts      # TipTap ↔ Markdown conversion
│   │   └── trpc.tsx           # tRPC client setup
│   ├── server/                # Server-side code
│   │   ├── auth.ts            # JWT auth helpers
│   │   ├── context.ts         # tRPC context
│   │   ├── db.ts              # Database client
│   │   ├── trpc.ts            # tRPC initialization
│   │   ├── collaboration/     # Yjs WebSocket server
│   │   ├── routers/           # tRPC routers
│   │   │   ├── _app.ts        # Root router
│   │   │   ├── page.ts        # Page CRUD
│   │   │   ├── io.ts          # Import/Export
│   │   │   ├── comment.ts     # Comments
│   │   │   ├── member.ts      # Workspace members
│   │   │   ├── tag.ts         # Tags
│   │   │   ├── template.ts    # Templates
│   │   │   ├── user.ts        # User profile
│   │   │   └── workspace.ts   # Workspace management
│   │   └── services/          # Business logic
│   │       ├── favorites.ts
│   │       ├── import-markdown.ts
│   │       ├── import-html.ts
│   │       ├── export-markdown.ts
│   │       ├── export-pdf.ts
│   │       ├── page-tree.ts
│   │       ├── permissions.ts
│   │       ├── search.ts
│   │       ├── snapshots.ts
│   │       └── version-history.ts
│   └── __tests__/             # Unit tests
│       ├── auth.test.ts
│       ├── page-tree.test.ts
│       ├── search.test.ts
│       ├── permissions.test.ts
│       ├── serializer.test.ts
│       ├── version-history.test.ts
│       ├── import-markdown.test.ts
│       └── export-markdown.test.ts
├── .github/workflows/
│   └── ci.yml                 # CI/CD pipeline
├── Dockerfile
├── docker-compose.yml
├── vitest.config.ts
└── package.json
```

## API Reference

### tRPC Routers

All authenticated endpoints require a Bearer token in the `Authorization` header.

#### Page Router (`page.*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `page.create` | Mutation | Create a new page |
| `page.getById` | Query | Get page by ID |
| `page.update` | Mutation | Update page content/title |
| `page.delete` | Mutation | Delete page and children |
| `page.list` | Query | List workspace pages |
| `page.move` | Mutation | Move page to new parent |
| `page.duplicate` | Mutation | Duplicate page subtree |
| `page.getTree` | Query | Get full page tree |
| `page.search` | Query | Full-text search |
| `page.getRecent` | Query | Recently edited pages |
| `page.toggleFavorite` | Mutation | Toggle favorite status |

#### Import/Export Router (`io.*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `io.importMarkdown` | Mutation | Import Markdown as new page |
| `io.importHtml` | Mutation | Import HTML as new page |
| `io.exportMarkdown` | Query | Export page as Markdown |
| `io.exportHtml` | Query | Export page as HTML |
| `io.exportPdf` | Query | Export page as PDF (stub) |
| `io.batchImport` | Mutation | Import multiple Markdown pages |

#### Other Routers

- **`comment.*`** — Create, list, update, delete, and resolve page comments
- **`tag.*`** — Add, remove, rename, and list tags
- **`template.*`** — Create, list, use, and delete templates
- **`workspace.*`** — Create, update, delete, and list workspaces
- **`member.*`** — Invite, remove, and manage workspace members
- **`user.*`** — Profile management and password changes

## Development

### Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npx vitest run       # Run all tests
npx vitest run --watch  # Watch mode
npx prisma studio    # Open Prisma Studio
```

### Adding Tests

Tests live in `src/__tests__/` and use Vitest. Mock external dependencies (Prisma, Yjs) to keep tests fast and isolated.

```bash
npx vitest run src/__tests__/auth.test.ts  # Run a single test file
```

## License

MIT
