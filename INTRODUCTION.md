# Mini Notion 项目介绍

---

## 一句话简介

Mini Notion 是一款基于 Next.js 构建的轻量级、可自托管的类 Notion 协作编辑平台，集成 TipTap 富文本编辑器和 Yjs CRDT 实时协作引擎。

---

## 项目背景

Notion 凭借块级编辑器、多层级页面组织和实时协作能力，成为团队知识管理的标杆。但其闭源 SaaS 模式带来数据主权、定制受限、网络依赖和成本压力等问题。Mini Notion 提供 Notion 的核心体验——块级富文本编辑、页面树、实时协作——同时完全自托管，支持 SQLite 存储，降低部署门槛。

---

## 核心功能

### 1. 块级富文本编辑器（核心）

基于 TipTap 构建，支持段落、H1-H3 标题、有序/无序列表、任务列表、代码块（Lowlight 语法高亮）、可调表格、图片、引用、高亮、分割线、呼出块等。配备 Slash 菜单（`/` 触发）、气泡菜单、工具栏和拖拽手柄。

### 2. 页面树

树形结构组织页面，无限层级嵌套。支持拖拽排序（`page.move`）、子树复制（`page.duplicate`）、软删除（`isDeleted`）和完整树查询（`page.getTree`）。

### 3. 实时协作

基于 Yjs CRDT 和 Socket.IO 的多人实时编辑。支持增量同步、光标感知（Awareness）、在线用户列表、断线重连自动同步。

### 4. 导入与导出

支持 Markdown / HTML 导入（含批量导入），Markdown / HTML / PDF 导出。基于 TipTap JSON 文档模型和自定义序列化器实现格式转换。

### 5. 评论系统

页面级线程式评论，支持创建/编辑/删除/解决。可将评论锚定到特定编辑器块（`blockId`）。

### 6. 版本历史与快照

自动版本快照（PageVersion）和手动快照（Snapshot），支持标签、恢复。每页最多保留 50 版本，超出自动裁剪。通过 `YjsManager.replaceDoc()` 实现完整状态替换恢复。

### 7. 工作空间与权限

多工作空间，四级角色（Owner/Admin/Member/Viewer），基于 Member 表的 RBAC 权限控制。支持 token 邮件邀请，所有资源严格绑定工作空间实现租户隔离。

---

## 技术架构

### 整体架构

```
┌────────────────────────────────────────────────────────┐
│                  前端 (Next.js 16)                       │
│  ┌────────┐  ┌──────────┐  ┌────────────────────────┐  │
│  │ TipTap │  │ React 19 │  │ Socket.IO Client       │  │
│  │ Editor │  │ Components│  │ (Collaboration)        │  │
│  └───┬────┘  └────┬─────┘  └──────────┬─────────────┘  │
│      │       ┌────┴────┐              │                │
│      │       │tRPC v11 │              │                │
│      │       └────┬────┘              │                │
└──────┼────────────┼───────────────────┼────────────────┘
       │            │                   │
  Yjs Updates   tRPC/HTTP          WebSocket
       │            │                   │
┌──────┼────────────┼───────────────────┼────────────────┐
│      │      服务端 (Node.js)           │                │
│ ┌────┴───┐  ┌─────┴─────┐  ┌─────────┴─────────────┐  │
│ │ Yjs    │  │ tRPC      │  │ Socket.IO Server      │  │
│ │Manager │  │ Routers   │  │ (Collab)              │  │
│ └───┬────┘  └────┬──────┘  └────────┬──────────────┘  │
│     └────────────┼──────────────────┘                  │
│            ┌─────┴─────┐                               │
│            │ Prisma ORM│                               │
│            └─────┬─────┘                               │
│            ┌─────┴─────┐                               │
│            │ SQLite DB │                               │
│            └───────────┘                               │
└────────────────────────────────────────────────────────┘
```

### 为什么选 TipTap + Yjs

**TipTap**：基于 ProseMirror 的无头编辑器框架。块级编辑模型天然契合 Notion 理念；Extension 机制可自由添加自定义块；`@tiptap/react` 与 React 19 无缝衔接；无样式约束，完全用 Tailwind CSS 控制 UI。

**Yjs**：高性能 CRDT 实现。去中心化合并，多客户端操作自动合并无冲突；增量同步只传输变更，带宽高效；提供 `y-websocket`、`y-protocols` 等配套库；支持 GC 和状态压缩；可与任意编辑器集成。

### CRDT 同步原理

CRDT（Conflict-free Replicated Data Type）是实时协作的理论基础。与 OT 需要中心服务器排序不同，CRDT 的每个操作都是自描述且可交换的，合并结果确定。

**Yjs 的实现机制：**
- 每个客户端维护全局递增唯一 ID 和 State Vector，追踪已知操作版本
- 每个编辑操作（插入/删除）携带客户端 ID 和逻辑时间戳
- 新操作可乱序到达，最终合并结果一致

**同步流程：** 客户端编辑 → 生成 Yjs Update → 发送到服务器 → 应用到 Y.Doc → 广播给同房间其他客户端 → 客户端应用 Update 完成同步。

**离线支持：** 断连后操作缓存本地 Y.Doc；重连时发送 State Vector，服务器返回缺失 Update，实现无损合并。

**Mini Notion 中的实现：** `YjsManager` 管理活跃 Y.Doc 实例——每页面一个 Doc，首次访问从 DB 加载；每 30 秒自动持久化；状态超 1MB 触发 GC 压缩；每页最多保留 50 版本。

---

## 数据模型

Prisma ORM + SQLite，共 8 个核心模型：

```
User ──1:N──> Workspace / Member / Page / Comment / Snapshot / PageVersion
Workspace ──1:N──> Member / Page / Invitation
Page ──1:1──> YjsState
Page ──1:N──> Comment / Snapshot / PageVersion
```

| 模型 | 说明 | 关键字段 |
|------|------|----------|
| **User** | 用户 | `email`(unique), `password`(bcrypt), `name`, `image` |
| **Workspace** | 工作空间 | `name`, `ownerId` → User |
| **Member** | 成员关系 | `userId`+`workspaceId`(unique), `role` |
| **Invitation** | 邀请 | `email`, `token`(unique), `expiresAt` |
| **Page** | 页面 | `title`, `content`(TipTap JSON), `isDeleted`, `workspaceId` |
| **Comment** | 评论 | `pageId`, `blockId`(可选), `resolved` |
| **PageVersion** | 版本 | `state`(Yjs 二进制), `label` |
| **Snapshot** | 快照 | `state`(Yjs 二进制), `metadata`(JSON) |
| **YjsState** | Yjs 持久化 | `pageId`(unique), `state`, `stateVector` |

`Page.content` 存储 TipTap JSON 用于快速加载；`YjsState.state` 存储 Yjs 二进制用于协作恢复。

---

## 编辑器系统

### 组件架构

```
editor/
├── BlockEditor.tsx              # 核心编辑器（入口）
├── EditorToolbar.tsx            # 格式化工具栏
├── EditorBubbleMenu.tsx         # 选中文本浮动菜单
├── blocks/                      # 6 个自定义块组件
│   ├── CalloutBlock / CodeBlock / DividerBlock
│   ├── ImageBlock / TableBlock / TaskBlock
└── extensions/                  # TipTap 扩展
    ├── slash-menu.tsx            # Slash 命令菜单
    ├── drag-handle.tsx           # 块拖拽手柄
    └── mentions.tsx              # @ 提及
```

### TipTap 扩展配置

`BlockEditor` 注册了 11 个扩展：StarterKit（禁用内置 codeBlock）、Placeholder、Image（支持 Base64）、Table 三件套（可调列宽）、CodeBlockLowlight（Lowlight 语法高亮）、TaskList+TaskItem（嵌套任务）、Link、Highlight（多色）、Typography。

### Slash 菜单

输入 `/` 触发，基于 `@tiptap/suggestion` 的 ProseMirror 插件。支持 Text、H1-H3、Bullet/Numbered/Task List、Quote、Code Block、Divider、Image 共 11 个菜单项。使用 `tippy.js` 定位浮层 + `ReactRenderer` 渲染 React 组件，支持键盘导航和模糊搜索。

### 自动保存

基于 500ms 防抖：`onUpdate → clearTimeout → setTimeout(() => onSave(JSON), debounceMs)`，内容以 TipTap JSON 序列化后持久化。

---

## 协作机制

### 组件

- `ws-server.ts`：Socket.IO 服务端，`/collab` 命名空间，管理房间和消息路由
- `yjs-manager.ts`：单例，管理 Y.Doc 生命周期、持久化、GC

### 核心协议

| 事件 | 方向 | 说明 |
|------|------|------|
| `join-room` | Client→Server | 加入页面房间 |
| `leave-room` | Client→Server | 离开房间 |
| `yjs-update` | 双向 | 增量操作同步 |
| `yjs-sync-request/response` | 双向 | 请求/返回完整状态 |
| `yjs-awareness` | 双向 | 光标/选区同步 |
| `presence-list` | Server→Client | 在线用户列表 |

### YjsManager 生命周期

**配置：** 持久化间隔 30s，GC 间隔 5min，GC 阈值 1MB，每页最多 50 版本。

**流程：** 首次访问从 `YjsState` 表加载或新建 Doc → 首个客户端连接启动定时器 → 脏文档每 30s 持久化 → 状态超 1MB 触发 GC 压缩 → 最后客户端断开立即持久化 → 优雅关闭时 `shutdown()` 持久化并销毁所有 Doc。

**版本恢复：** `replaceDoc()` 销毁旧 Doc、创建新 Doc 应用目标状态、立即持久化，实现完整状态替换。

---

## API 概览

### REST 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 注册 |
| `/api/auth/login` | POST | 登录（返回 JWT） |
| `/api/auth/refresh` | POST | 刷新 Token |

### tRPC Router（8 个）

| Router | 核心端点 |
|--------|----------|
| `page` | `create`, `getById`, `update`, `delete`, `list`, `move`, `duplicate`, `getTree`, `search`, `toggleFavorite` |
| `io` | `importMarkdown`, `importHtml`, `exportMarkdown`, `exportHtml`, `batchImport` |
| `comment` | `create`, `list`, `update`, `delete`, `resolve` |
| `tag` | `add`, `remove`, `rename`, `list` |
| `template` | `create`, `list`, `use`, `delete` |
| `workspace` | `create`, `update`, `delete`, `list` |
| `member` | `invite`, `remove`, `updateRole` |
| `user` | `profile`, `updateProfile`, `changePassword` |

所有端点需 `Authorization: Bearer <token>` 认证，工作空间级操作需 `x-workspace-id` 头。

---

## 安全特性

- **JWT 双 Token**：短期 Access Token + 长期 Refresh Token
- **密码加密**：bcryptjs 哈希，注册强制 8-100 字符
- **RBAC 权限**：Owner → Admin → Member → Viewer 四级，统一权限检查（`services/permissions.ts`）
- **租户隔离**：所有资源绑定工作空间
- **输入校验**：Zod schema + TypeScript 编译期类型检查 + Prisma 参数化查询
- **软删除**：页面 `isDeleted` 标记 + 数据库级级联删除

---

## 部署指南

### 环境变量

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
NEXTAUTH_SECRET="your-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 开发部署

```bash
git clone <repo-url> && cd mini-notion
npm install
cp .env.example .env
npx prisma generate && npx prisma migrate dev
npx prisma db seed
npm run dev
```

演示账号：`admin@example.com / admin123`（Admin）、`member@example.com / member123`（Member）。

### Docker

```bash
docker compose up -d
```

### 生产构建

```bash
npm run build && npm run start
```

---

## 开发指南

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint 检查 |
| `npm run test` | 运行 Vitest 测试 |
| `npm run test:watch` | 监听模式 |
| `npx prisma studio` | 数据库管理界面 |

**测试覆盖：** 8 个测试文件（`src/__tests__/`）覆盖 auth、page-tree、search、permissions、serializer、version-history、import/export-markdown。

---

## 项目结构

```
mini-notion/
├── prisma/                       # 数据库 Schema、种子脚本、配置
├── src/
│   ├── app/                      # Next.js App Router（页面 + API 路由）
│   ├── components/
│   │   ├── collaboration/        # 实时光标与在线状态
│   │   └── editor/               # TipTap 编辑器系统（核心 + 块 + 扩展）
│   ├── hooks/                    # React Hooks
│   ├── lib/                      # Prisma 单例、序列化器、tRPC 客户端
│   ├── server/
│   │   ├── auth.ts / context.ts / db.ts / trpc.ts   # 基础设施
│   │   ├── collaboration/        # ws-server.ts + yjs-manager.ts
│   │   ├── routers/              # 8 个 tRPC 路由
│   │   └── services/             # 10 个业务服务
│   └── __tests__/                # 8 个测试文件
├── .github/workflows/ci.yml     # CI/CD
├── Dockerfile / docker-compose.yml
└── vitest.config.ts
```

### 技术栈

| 层级 | 选型 |
|------|------|
| 前端 | Next.js 16 · React 19 · Tailwind CSS v4 |
| 编辑器 | TipTap 3.x (ProseMirror) |
| API | tRPC v11 · Zod v4 |
| 数据库 | Prisma 7 · SQLite |
| 实时协作 | Yjs 13.x · Socket.IO |
| 认证 | JWT + bcryptjs |
| 测试 | Vitest v4 · Playwright |
| 部署 | Docker |

---

> Mini Notion —— 你的私有化知识协作平台。
