# mini-notion API Reference

Base URL: `http://localhost:3000`

Authentication is via JWT Bearer tokens (header: `Authorization: Bearer <token>`) or cookies (`access_token=<token>`).

Workspace-scoped tRPC endpoints require the `x-workspace-id` header.

---

## Table of Contents

- [REST Endpoints](#rest-endpoints)
  - [POST /api/auth/register](#post-apiauthregister)
  - [POST /api/auth/login](#post-apiauthlogin)
  - [POST /api/auth/refresh](#post-apiauthrefresh)
  - [GET|POST /api/auth/[...nextauth]](#getpost-apiauthnextauth)
- [tRPC Endpoints](#trpc-endpoints)
  - [User Router](#user-router)
  - [Workspace Router](#workspace-router)
  - [Page Router](#page-router)
  - [Tag Router](#tag-router)
  - [Template Router](#template-router)
  - [Comment Router](#comment-router)
  - [Member Router](#member-router)
  - [I/O Router (Import/Export)](#io-router-importexport)
- [WebSocket (Collaboration)](#websocket-collaboration)
- [Prisma Schema Reference](#prisma-schema-reference)

---

## REST Endpoints

### POST /api/auth/register

Register a new user account.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepass8",
  "name": "John Doe"
}
```

| Field      | Type     | Required | Constraints          |
|------------|----------|----------|----------------------|
| `email`    | string   | yes      | valid email          |
| `password` | string   | yes      | 8-100 characters     |
| `name`     | string   | no       | 1-100 characters     |

**Response (201):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "image": null,
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

**Errors:**

| Status | Body                                                  |
|--------|-------------------------------------------------------|
| 400    | `{ "error": "Validation failed", "details": [...] }`  |
| 409    | `{ "error": "Email already in use" }`                 |
| 500    | `{ "error": "Internal server error" }`                |

---

### POST /api/auth/login

Authenticate with email and password.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepass8"
}
```

| Field      | Type   | Required | Constraints |
|------------|--------|----------|-------------|
| `email`    | string | yes      | valid email |
| `password` | string | yes      | min 1 char  |

**Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "image": null
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

**Errors:**

| Status | Body                                                     |
|--------|----------------------------------------------------------|
| 400    | `{ "error": "Validation failed", "details": [...] }`     |
| 401    | `{ "error": "Invalid email or password" }`               |
| 500    | `{ "error": "Internal server error" }`                   |

---

### POST /api/auth/refresh

Exchange a refresh token for a new token pair.

**Request:**

```json
{
  "refreshToken": "eyJhbGci..."
}
```

| Field         | Type   | Required |
|---------------|--------|----------|
| `refreshToken`| string | yes      |

**Response (200):**

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

**Errors:**

| Status | Body                                                            |
|--------|-----------------------------------------------------------------|
| 400    | `{ "error": "Validation failed", "details": [...] }`            |
| 401    | `{ "error": "Invalid or expired refresh token" }` / `"User not found"` |
| 500    | `{ "error": "Internal server error" }`                          |

---

### GET|POST /api/auth/[...nextauth]

NextAuth.js handler for credentials-based authentication. Used for browser-based OAuth flow.

---

## tRPC Endpoints

All tRPC endpoints are served from `/api/trpc`. Use the tRPC client or make batch requests via GET/POST.

**Headers required for workspace-scoped endpoints:**

```
Authorization: Bearer <accessToken>
x-workspace-id: <workspace-uuid>
```

### User Router

#### `user.getMe`

**Type:** Query (protected)

**Response:**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "image": "https://...",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

#### `user.updateProfile`

**Type:** Mutation (protected)

**Input:**

```json
{
  "name": "New Name",
  "image": "https://example.com/avatar.png"
}
```

| Field   | Type     | Required | Constraints    |
|---------|----------|----------|----------------|
| `name`  | string   | no       | 1-100 chars    |
| `image` | string   | no       | valid URL      |

**Response:**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "New Name",
  "image": "https://example.com/avatar.png",
  "updatedAt": "2025-01-02T00:00:00.000Z"
}
```

#### `user.changePassword`

**Type:** Mutation (protected)

**Input:**

```json
{
  "currentPassword": "oldpass123",
  "newPassword": "newpass456"
}
```

| Field             | Type   | Required | Constraints       |
|-------------------|--------|----------|-------------------|
| `currentPassword` | string | yes      | min 1 char        |
| `newPassword`     | string | yes      | 8-100 characters  |

**Response:**

```json
{ "success": true }
```

**Errors:** `"No password set for this account"`, `"Current password is incorrect"`

#### `user.deleteAccount`

**Type:** Mutation (protected)

**Response:**

```json
{ "success": true }
```

---

### Workspace Router

#### `workspace.create`

**Type:** Mutation (protected)

**Input:**

```json
{
  "name": "My Workspace",
  "icon": "🚀"
}
```

| Field  | Type   | Required | Constraints     |
|--------|--------|----------|-----------------|
| `name` | string | yes      | 1-100 chars     |
| `icon` | string | no       | max 10 chars    |

**Response:**

```json
{
  "id": "uuid",
  "name": "My Workspace",
  "icon": "🚀",
  "ownerId": "user-uuid",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "members": [
    { "id": "member-uuid", "userId": "user-uuid", "workspaceId": "uuid", "role": "OWNER" }
  ]
}
```

#### `workspace.getById`

**Type:** Query (protected)

**Input:** `{ "id": "workspace-uuid" }`

**Response:**

```json
{
  "id": "uuid",
  "name": "My Workspace",
  "icon": "🚀",
  "members": [
    { "id": "...", "user": { "id": "...", "name": "...", "email": "...", "image": "..." } }
  ],
  "_count": { "pages": 5 }
}
```

**Errors:** `"You are not a member of this workspace"`

#### `workspace.update`

**Type:** Mutation (protected, OWNER only)

**Input:**

```json
{
  "id": "workspace-uuid",
  "name": "Updated Name",
  "icon": "🎯"
}
```

**Response:** Updated workspace object.

**Errors:** `"Only the workspace owner can update it"`

#### `workspace.delete`

**Type:** Mutation (protected, OWNER only)

**Input:** `{ "id": "workspace-uuid" }`

**Response:** `{ "success": true }`

#### `workspace.list`

**Type:** Query (protected)

**Response:** Array of workspaces the user belongs to, with role, member count, and page count:

```json
[
  {
    "id": "uuid",
    "name": "My Workspace",
    "icon": "🚀",
    "role": "OWNER",
    "memberCount": 3,
    "pageCount": 12
  }
]
```

#### `workspace.getCurrentWorkspace`

**Type:** Query (protected)

**Response:** The user's first (oldest) workspace with full member details, or `null`.

---

### Page Router

All page endpoints require the `x-workspace-id` header.

#### `page.create`

**Type:** Mutation (workspace)

**Input:**

```json
{
  "title": "My Page",
  "icon": "📝",
  "content": "[{\"type\":\"doc\",\"content\":[]}]",
  "parentId": "parent-page-uuid"
}
```

| Field      | Type     | Required | Constraints              |
|------------|----------|----------|--------------------------|
| `title`    | string   | no       | 1-500 chars, default "Untitled" |
| `icon`     | string   | no       | nullable                 |
| `content`  | string   | no       | JSON string, default "[]" |
| `parentId` | uuid     | no       | nullable, must exist in workspace |

**Response:**

```json
{
  "id": "uuid",
  "title": "My Page",
  "icon": "📝",
  "content": "[{\"type\":\"doc\",\"content\":[]}]",
  "workspaceId": "uuid",
  "parentId": "parent-uuid",
  "order": 1,
  "tags": [],
  "parent": { "id": "...", "title": "...", "icon": "..." },
  "children": []
}
```

#### `page.getById`

**Type:** Query (workspace)

**Input:** `{ "id": "page-uuid" }`

**Response:** Full page with tags, parent, and sorted children.

#### `page.update`

**Type:** Mutation (workspace)

**Input:**

```json
{
  "id": "page-uuid",
  "title": "Updated Title",
  "icon": "🆕",
  "content": "[...]"
}
```

All fields except `id` are optional (partial update).

#### `page.delete`

**Type:** Mutation (workspace)

**Input:** `{ "id": "page-uuid" }`

Deletes the page and all descendants, along with associated tags, comments, versions, and favorites.

**Response:** `{ "deletedIds": ["uuid", "uuid", ...] }`

#### `page.list`

**Type:** Query (workspace)

**Input:**

```json
{
  "parentId": "parent-uuid",
  "limit": 50,
  "cursor": "cursor-uuid"
}
```

| Field      | Type   | Required | Constraints            |
|------------|--------|----------|------------------------|
| `parentId` | uuid   | no       | nullable, filter by parent |
| `limit`    | number | no       | 1-200, default 50      |
| `cursor`   | string | no       | pagination cursor (page id) |

**Response:**

```json
{
  "items": [...],
  "nextCursor": "next-page-uuid"
}
```

#### `page.move`

**Type:** Mutation (workspace)

**Input:**

```json
{
  "id": "page-uuid",
  "newParentId": "new-parent-uuid",
  "order": 2
}
```

Moves a page to a new parent (or root if `newParentId` is null). Prevents cycles.

#### `page.duplicate`

**Type:** Mutation (workspace)

**Input:**

```json
{
  "id": "page-uuid",
  "title": "Custom Copy Title"
}
```

Recursively duplicates the page and all children. Tags are copied.

#### `page.getTree`

**Type:** Query (workspace)

**Response:** Full hierarchical page tree for sidebar rendering.

#### `page.search`

**Type:** Query (workspace)

**Input:**

```json
{
  "query": "search term",
  "tags": ["important", "draft"],
  "createdAfter": "2025-01-01T00:00:00.000Z",
  "createdBefore": "2025-12-31T23:59:59.000Z",
  "updatedAfter": "2025-01-01T00:00:00.000Z",
  "updatedBefore": "2025-12-31T23:59:59.000Z"
}
```

| Field           | Type     | Required | Constraints         |
|-----------------|----------|----------|---------------------|
| `query`         | string   | yes      | 1-200 chars         |
| `tags`          | string[] | no       | filter by tag names |
| `createdAfter`  | date     | no       | ISO datetime        |
| `createdBefore` | date     | no       | ISO datetime        |
| `updatedAfter`  | date     | no       | ISO datetime        |
| `updatedBefore` | date     | no       | ISO datetime        |

**Response:** Array of pages with search metadata:

```json
[
  {
    "id": "uuid",
    "title": "Page Title",
    "score": 0.95,
    "matchedTitle": true,
    "matchedContent": false,
    "highlights": ["..."]
  }
]
```

#### `page.getRecent`

**Type:** Query (workspace)

**Input:** `{ "limit": 10 }` (default 10, max 50)

**Response:** Array of recently updated pages with tags.

#### `page.getFavorites`

**Type:** Query (workspace)

**Response:** Array of favorited pages for the current user in this workspace.

#### `page.toggleFavorite`

**Type:** Mutation (workspace)

**Input:** `{ "pageId": "page-uuid" }`

**Response:** `{ "isFavorited": true }` or `{ "isFavorited": false }`

---

### Tag Router

All tag endpoints require the `x-workspace-id` header.

#### `tag.create`

**Type:** Mutation (workspace)

**Input:**

```json
{
  "pageId": "page-uuid",
  "name": "important"
}
```

| Field    | Type   | Required | Constraints   |
|----------|--------|----------|---------------|
| `pageId` | uuid   | yes      | must exist    |
| `name`   | string | yes      | 1-100 chars   |

**Response:** Created tag object `{ "id": "...", "pageId": "...", "name": "important" }`

**Errors:** `"This tag already exists on this page."` (409 CONFLICT)

#### `tag.remove`

**Type:** Mutation (workspace)

**Input:** `{ "pageId": "page-uuid", "name": "important" }`

**Response:** `{ "removed": true }` or `{ "removed": false }`

#### `tag.list`

**Type:** Query (workspace)

**Response:** All unique tags in the workspace with usage counts:

```json
[
  { "name": "important", "count": 5 },
  { "name": "draft", "count": 2 }
]
```

#### `tag.rename`

**Type:** Mutation (workspace)

**Input:** `{ "oldName": "important", "newName": "critical" }`

Renames the tag across all pages in the workspace.

**Response:** `{ "updated": 3 }`

**Errors:** `"The tag \"critical\" already exists on N page(s). Remove it first..."`

#### `tag.delete`

**Type:** Mutation (workspace)

**Input:** `{ "name": "important" }`

Removes the tag from all pages in the workspace.

**Response:** `{ "deleted": 5 }`

---

### Template Router

All template endpoints require the `x-workspace-id` header.

#### `template.create`

**Type:** Mutation (workspace)

**Input:**

```json
{
  "pageId": "page-uuid",
  "name": "Meeting Notes Template",
  "description": "Standard meeting notes format"
}
```

| Field         | Type   | Required | Constraints      |
|---------------|--------|----------|------------------|
| `pageId`      | uuid   | yes      | must exist       |
| `name`        | string | yes      | 1-200 chars      |
| `description` | string | no       | max 1000 chars   |

**Response:** Created template object.

#### `template.list`

**Type:** Query (workspace)

**Response:** Array of templates in the workspace, ordered by creation date (newest first).

#### `template.use`

**Type:** Mutation (workspace)

**Input:**

```json
{
  "templateId": "template-uuid",
  "title": "My New Page",
  "parentId": "parent-page-uuid"
}
```

Creates a new page from the template's content and icon.

#### `template.delete`

**Type:** Mutation (workspace)

**Input:** `{ "id": "template-uuid" }`

**Response:** `{ "deleted": true }`

---

### Comment Router

Comment endpoints use `protectedProcedure` (auth required, no workspace header needed — workspace access is checked via the page).

#### `comment.create`

**Type:** Mutation (protected)

**Input:**

```json
{
  "pageId": "page-uuid",
  "content": "This needs revision",
  "blockId": "block-uuid"
}
```

| Field     | Type   | Required | Constraints      |
|-----------|--------|----------|------------------|
| `pageId`  | uuid   | yes      | must exist       |
| `content` | string | yes      | 1-10000 chars    |
| `blockId` | uuid   | no       | associate with a content block |

**Response:** Created comment with author info:

```json
{
  "id": "uuid",
  "pageId": "page-uuid",
  "authorId": "user-uuid",
  "blockId": "block-uuid",
  "content": "This needs revision",
  "resolved": false,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "author": { "id": "...", "name": "...", "image": "..." }
}
```

#### `comment.list`

**Type:** Query (protected)

**Input:**

```json
{
  "pageId": "page-uuid",
  "includeResolved": false,
  "limit": 50,
  "cursor": "comment-uuid"
}
```

| Field              | Type    | Required | Constraints          |
|--------------------|---------|----------|----------------------|
| `pageId`           | uuid    | yes      | must exist           |
| `includeResolved`  | boolean | no       | default false        |
| `limit`            | number  | no       | 1-100, default 50    |
| `cursor`           | string  | no       | pagination cursor    |

**Response:**

```json
{
  "comments": [...],
  "nextCursor": "next-comment-uuid"
}
```

#### `comment.getById`

**Type:** Query (protected)

**Input:** `{ "commentId": "comment-uuid" }`

#### `comment.update`

**Type:** Mutation (protected)

**Input:** `{ "commentId": "comment-uuid", "content": "Updated text" }`

Only the comment author can update.

#### `comment.delete`

**Type:** Mutation (protected)

**Input:** `{ "commentId": "comment-uuid" }`

Author or workspace OWNER/ADMIN can delete.

**Response:** `{ "success": true, "id": "comment-uuid" }`

#### `comment.resolve`

**Type:** Mutation (protected)

**Input:** `{ "commentId": "comment-uuid", "resolved": true }`

**Response:** Updated comment object.

#### `comment.unresolvedCount`

**Type:** Query (protected)

**Input:** `{ "pageId": "page-uuid" }`

**Response:** `{ "count": 3 }`

---

### Member Router

#### `member.invite`

**Type:** Mutation (protected)

**Input:**

```json
{
  "workspaceId": "workspace-uuid",
  "email": "teammate@example.com",
  "role": "MEMBER"
}
```

| Field         | Type   | Required | Constraints              |
|---------------|--------|----------|--------------------------|
| `workspaceId` | uuid   | yes      | must exist               |
| `email`       | string | yes      | valid email              |
| `role`        | enum   | no       | ADMIN/MEMBER/VIEWER, default MEMBER |

Only OWNER/ADMIN can invite. Creates an invitation token (expires in 7 days).

**Response:** Invitation object with `token`, `expiresAt`.

#### `member.remove`

**Type:** Mutation (protected)

**Input:**

```json
{
  "workspaceId": "workspace-uuid",
  "userId": "user-uuid"
}
```

Self-removal is allowed. Admins can remove others. Owner cannot be removed.

#### `member.updateRole`

**Type:** Mutation (protected)

**Input:**

```json
{
  "workspaceId": "workspace-uuid",
  "userId": "user-uuid",
  "role": "ADMIN"
}
```

Only ADMIN or OWNER can change roles. Owner's role cannot be changed.

#### `member.list`

**Type:** Query (protected)

**Input:** `{ "workspaceId": "workspace-uuid" }`

**Response:** Array of members with user details.

#### `member.acceptInvite`

**Type:** Mutation (protected)

**Input:** `{ "token": "invitation-token" }`

Accepts an invitation, adds user as workspace member, and deletes the invitation.

**Errors:** `"Invitation not found"`, `"Invitation has expired"`, `"This invitation is not for your email address"`

---

### I/O Router (Import/Export)

All I/O endpoints require the `x-workspace-id` header.

#### `io.importMarkdown`

**Type:** Mutation (workspace)

**Input:**

```json
{
  "markdown": "# Hello World\n\nSome content here.",
  "title": "Imported Page",
  "parentId": "parent-uuid"
}
```

| Field      | Type   | Required | Constraints               |
|------------|--------|----------|---------------------------|
| `markdown` | string | yes      | 1-1000000 chars           |
| `title`    | string | no       | 1-500 chars, extracted from markdown if omitted |
| `parentId` | uuid   | no       | nullable, must exist      |

**Response:** Created page object with tags, parent, and children.

#### `io.importHtml`

**Type:** Mutation (workspace)

**Input:**

```json
{
  "html": "<h1>Hello</h1><p>Content</p>",
  "title": "Imported Page",
  "parentId": "parent-uuid"
}
```

| Field    | Type   | Required | Constraints       |
|----------|--------|----------|-------------------|
| `html`   | string | yes      | 1-5000000 chars   |
| `title`  | string | no       | 1-500 chars       |
| `parentId` | uuid | no       | nullable          |

#### `io.exportMarkdown`

**Type:** Query (workspace)

**Input:** `{ "pageId": "page-uuid" }`

**Response:**

```json
{
  "markdown": "# Page Title\n\nContent in markdown...",
  "title": "Page Title"
}
```

#### `io.exportHtml`

**Type:** Query (workspace)

**Input:** `{ "pageId": "page-uuid" }`

**Response:**

```json
{
  "html": "<h1>Page Title</h1><p>Content...</p>",
  "title": "Page Title"
}
```

#### `io.exportPdf`

**Type:** Query (workspace)

**Input:** `{ "pageId": "page-uuid" }`

**Response:**

```json
{
  "html": "<html>...</html>",
  "title": "Page Title",
  "message": "PDF export requires a headless browser. The HTML content is ready for rendering."
}
```

#### `io.batchImport`

**Type:** Mutation (workspace)

**Input:**

```json
{
  "items": [
    {
      "markdown": "# Page 1\n\nContent...",
      "title": "Page 1",
      "parentId": "parent-uuid"
    },
    {
      "markdown": "# Page 2\n\nContent...",
      "title": "Page 2",
      "parentId": "parent-uuid"
    }
  ]
}
```

| Field   | Type       | Required | Constraints        |
|---------|------------|----------|--------------------|
| `items` | object[]   | yes      | 1-50 items         |
| `items[].markdown` | string | yes | 1-1000000 chars |
| `items[].title` | string | no   | 1-500 chars        |
| `items[].parentId` | uuid | no  | nullable           |

**Response:**

```json
{
  "imported": 2,
  "failed": 0,
  "results": [
    { "id": "uuid", "title": "Page 1", "success": true },
    { "id": "uuid", "title": "Page 2", "success": true }
  ]
}
```

---

## WebSocket (Collaboration)

Connect to the Socket.IO collaboration server on the `/collab` namespace.

**Default URL:** `ws://localhost:3000/collab` (or as configured via `NEXT_PUBLIC_APP_URL`)

### Events

#### Client → Server

| Event              | Payload                                                                                | Description                          |
|--------------------|----------------------------------------------------------------------------------------|--------------------------------------|
| `join-room`        | `{ pageId, userId, userName, userAvatar? }`                                            | Join a page's collaboration room     |
| `yjs-update`       | `{ pageId, update: number[] }`                                                         | Send a Yjs document update           |
| `yjs-sync-request` | `{ pageId, stateVector?: number[] }`                                                   | Request full document state          |
| `yjs-awareness`    | `{ pageId, awareness: { userId, userName, userAvatar?, cursor } }`                     | Broadcast cursor/selection position  |
| `presence-request` | `{ pageId }`                                                                           | Request list of active users         |
| `leave-room`       | `{ pageId }`                                                                           | Leave a collaboration room           |

#### Server → Client

| Event              | Payload                                                                                | Description                          |
|--------------------|----------------------------------------------------------------------------------------|--------------------------------------|
| `yjs-update`       | `{ pageId, update: number[], senderId }`                                               | Received Yjs update from another user|
| `yjs-sync-response`| `{ pageId, state: number[] }`                                                          | Full document state response         |
| `yjs-awareness`    | `{ pageId, socketId, awareness }`                                                      | Another user's cursor update         |
| `presence-list`    | `{ pageId, users: [{ socketId, userId, userName, userAvatar, cursor, lastActive }] }`  | List of active collaborators         |
| `user-left`        | `{ pageId, socketId }`                                                                 | A user left the room                 |
| `error`            | `{ message }`                                                                          | Error message                        |

### Usage Example

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000/collab", {
  transports: ["websocket"],
});

// Join a page room
socket.emit("join-room", {
  pageId: "page-uuid",
  userId: "user-uuid",
  userName: "John Doe",
});

// Listen for real-time updates
socket.on("yjs-update", ({ pageId, update }) => {
  // Apply Yjs update to local document
});

socket.on("presence-list", ({ users }) => {
  // Update UI with active collaborators
});
```

---

## Prisma Schema Reference

### Models

#### User

| Field       | Type     | Notes              |
|-------------|----------|--------------------|
| `id`        | UUID     | Primary key        |
| `email`     | String   | Unique             |
| `name`      | String?  | Display name       |
| `password`  | String?  | bcrypt hash        |
| `image`     | String?  | Avatar URL         |
| `createdAt` | DateTime | Auto               |
| `updatedAt` | DateTime | Auto               |

#### Workspace

| Field       | Type     | Notes                           |
|-------------|----------|---------------------------------|
| `id`        | UUID     | Primary key                     |
| `name`      | String   | Workspace name                  |
| `icon`      | String?  | Emoji or icon identifier        |
| `ownerId`   | String   | FK → User (cascade delete)      |
| `createdAt` | DateTime | Auto                            |
| `updatedAt` | DateTime | Auto                            |

#### Member

| Field         | Type     | Notes                                |
|---------------|----------|--------------------------------------|
| `id`          | UUID     | Primary key                          |
| `role`        | String   | OWNER / ADMIN / MEMBER / VIEWER      |
| `userId`      | String   | FK → User (cascade delete)           |
| `workspaceId` | String   | FK → Workspace (cascade delete)      |
|               |          | Unique constraint: [userId, workspaceId] |

#### Invitation

| Field         | Type     | Notes                                |
|---------------|----------|--------------------------------------|
| `id`          | UUID     | Primary key                          |
| `email`       | String   | Invitee email                        |
| `role`        | String   | Role to assign on acceptance         |
| `token`       | String   | Unique invitation token              |
| `expiresAt`   | DateTime | Expiration timestamp                 |
| `workspaceId` | String   | FK → Workspace (cascade delete)      |
|               |          | Unique constraint: [email, workspaceId] |

#### Page

| Field         | Type     | Notes                                |
|---------------|----------|--------------------------------------|
| `id`          | UUID     | Primary key                          |
| `title`       | String   | Page title                           |
| `icon`        | String?  | Emoji or icon                        |
| `content`     | String?  | TipTap JSON content                  |
| `isDeleted`   | Boolean  | Soft delete flag                     |
| `parentId`    | String?  | FK → Page (self-referential, nullable)|
| `order`       | Float    | Sort order within parent             |
| `workspaceId` | String   | FK → Workspace (cascade delete)      |
| `createdById` | String   | FK → User (cascade delete)           |
| `createdAt`   | DateTime | Auto                                 |
| `updatedAt`   | DateTime | Auto                                 |

#### Comment

| Field       | Type     | Notes                           |
|-------------|----------|---------------------------------|
| `id`        | UUID     | Primary key                     |
| `pageId`    | String   | FK → Page (cascade delete)      |
| `authorId`  | String   | FK → User (cascade delete)      |
| `blockId`   | String?  | Optional content block anchor   |
| `content`   | String   | Comment text (max 10000)        |
| `resolved`  | Boolean  | Default false                   |
| `createdAt` | DateTime | Auto                            |
| `updatedAt` | DateTime | Auto                            |

#### PageVersion

| Field       | Type     | Notes                           |
|-------------|----------|---------------------------------|
| `id`        | UUID     | Primary key                     |
| `pageId`    | String   | FK → Page (cascade delete)      |
| `authorId`  | String   | FK → User (cascade delete)      |
| `state`     | Bytes    | Yjs binary state                |
| `label`     | String?  | Version label                   |
| `content`   | String?  | Optional content snapshot       |
| `createdAt` | DateTime | Auto                            |

#### Snapshot

| Field       | Type     | Notes                           |
|-------------|----------|---------------------------------|
| `id`        | UUID     | Primary key                     |
| `pageId`    | String   | FK → Page (cascade delete)      |
| `authorId`  | String   | FK → User (cascade delete)      |
| `state`     | Bytes    | Yjs binary state                |
| `metadata`  | String   | JSON metadata, default "{}"     |
| `createdAt` | DateTime | Auto                            |

#### YjsState

| Field         | Type     | Notes                           |
|---------------|----------|---------------------------------|
| `id`          | UUID     | Primary key                     |
| `pageId`      | String   | FK → Page (cascade delete), unique |
| `state`       | Bytes    | Current Yjs document state      |
| `stateVector` | Bytes?   | Yjs state vector for sync       |
| `createdAt`   | DateTime | Auto                            |
| `updatedAt`   | DateTime | Auto                            |
