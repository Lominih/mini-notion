# Mini Notion

一款轻量级、可自托管的 Notion 替代方案，基于 Next.js、tRPC、Prisma 和 TipTap 构建。

## 功能特性

- **富文本编辑器** — 基于 TipTap 的块级编辑器，支持标题、列表、代码块、表格、图片、任务列表等
- **页面树** — 嵌套层级组织页面，支持拖拽排序
- **实时协作** — 基于 Yjs 的实时编辑，支持在线状态指示和光标覆盖
- **导入导出** — 支持从 Markdown 和 HTML 导入；导出为 Markdown、HTML 和 PDF
- **评论系统** — 页面级线程式评论，支持标记已解决/未解决
- **版本历史** — 自动版本快照，支持恢复
- **全文搜索** — 跨页面标题和内容的全文检索，支持相关性评分
- **工作空间** — 多工作空间支持，基于角色的访问控制（Owner、Admin、Member、Viewer）
- **标签** — 为页面添加标签，便于组织和筛选
- **模板** — 保存和复用页面模板
- **收藏** — 标记常用页面
- **身份认证** — 基于 JWT 的认证，支持刷新令牌

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16、React 19、TipTap、Tailwind CSS v4 |
| API | tRPC v11、Zod 校验 |
| 数据库 | SQLite（通过 Prisma 7） |
| 实时 | Yjs、Socket.IO |
| 认证 | 自定义 JWT + bcryptjs |
| 编辑器 | TipTap + StarterKit + 扩展 |
| 测试 | Vitest |
| 容器 | Docker |

## 快速开始

### 环境要求

- Node.js 20+
- npm

### 安装

```bash
# 克隆仓库
git clone <repo-url>
cd mini-notion

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# 初始化数据库
npx prisma db seed

# 启动开发服务器
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

### 演示账号

初始化数据后，可使用以下账号登录：

| 角色 | 邮箱 | 密码 |
|------|------|------|
| Admin | admin@example.com | admin123 |
| Member | member@example.com | member123 |

## Docker

### 快速启动

```bash
docker compose up -d
```

### 手动构建

```bash
docker build -t mini-notion .
docker run -p 3000:3000 \
  -e DATABASE_URL="file:./dev.db" \
  -e JWT_SECRET="your-secret" \
  -e NEXTAUTH_SECRET="your-nextauth-secret" \
  mini-notion
```

## 项目结构

```
mini-notion/
├── prisma/
│   ├── schema.prisma          # 数据库 Schema
│   ├── seed.ts                # 演示数据填充
│   └── config.ts              # Prisma 配置
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/               # API 路由（tRPC、auth）
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/            # React 组件
│   │   ├── collaboration/     # 实时光标与在线状态
│   │   └── editor/            # TipTap 编辑器与块组件
│   ├── hooks/                 # React Hooks
│   ├── lib/                   # 工具函数与配置
│   │   ├── prisma.ts          # Prisma Client 单例
│   │   ├── serializer.ts      # TipTap ↔ Markdown 转换
│   │   └── trpc.tsx           # tRPC Client 配置
│   ├── server/                # 服务端代码
│   │   ├── auth.ts            # JWT 认证工具
│   │   ├── context.ts         # tRPC 上下文
│   │   ├── db.ts              # 数据库客户端
│   │   ├── trpc.ts            # tRPC 初始化
│   │   ├── collaboration/     # Yjs WebSocket 服务端
│   │   ├── routers/           # tRPC Router
│   │   │   ├── _app.ts        # 根 Router
│   │   │   ├── page.ts        # 页面 CRUD
│   │   │   ├── io.ts          # 导入/导出
│   │   │   ├── comment.ts     # 评论
│   │   │   ├── member.ts      # 工作空间成员
│   │   │   ├── tag.ts         # 标签
│   │   │   ├── template.ts    # 模板
│   │   │   ├── user.ts        # 用户资料
│   │   │   └── workspace.ts   # 工作空间管理
│   │   └── services/          # 业务逻辑
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
│   └── __tests__/             # 单元测试
│       ├── auth.test.ts
│       ├── page-tree.test.ts
│       ├── search.test.ts
│       ├── permissions.test.ts
│       ├── serializer.test.ts
│       ├── version-history.test.ts
│       ├── import-markdown.test.ts
│       └── export-markdown.test.ts
├── .github/workflows/
│   └── ci.yml                 # CI/CD 流水线
├── Dockerfile
├── docker-compose.yml
├── vitest.config.ts
└── package.json
```

## API 参考

### tRPC Router

所有已认证端点均需在 `Authorization` 头中携带 Bearer 令牌。

#### 页面 Router（`page.*`）

| 端点 | 方法 | 描述 |
|------|------|------|
| `page.create` | Mutation | 创建新页面 |
| `page.getById` | Query | 根据 ID 获取页面 |
| `page.update` | Mutation | 更新页面内容/标题 |
| `page.delete` | Mutation | 删除页面及子页面 |
| `page.list` | Query | 列出工作空间页面 |
| `page.move` | Mutation | 移动页面到新的父级 |
| `page.duplicate` | Mutation | 复制页面子树 |
| `page.getTree` | Query | 获取完整页面树 |
| `page.search` | Query | 全文搜索 |
| `page.getRecent` | Query | 最近编辑的页面 |
| `page.toggleFavorite` | Mutation | 切换收藏状态 |

#### 导入/导出 Router（`io.*`）

| 端点 | 方法 | 描述 |
|------|------|------|
| `io.importMarkdown` | Mutation | 从 Markdown 导入为新页面 |
| `io.importHtml` | Mutation | 从 HTML 导入为新页面 |
| `io.exportMarkdown` | Query | 导出页面为 Markdown |
| `io.exportHtml` | Query | 导出页面为 HTML |
| `io.exportPdf` | Query | 导出页面为 PDF（占位） |
| `io.batchImport` | Mutation | 批量导入多个 Markdown 页面 |

#### 其他 Router

- **`comment.*`** — 创建、列出、更新、删除和解决页面评论
- **`tag.*`** — 添加、移除、重命名和列出标签
- **`template.*`** — 创建、列出、使用和删除模板
- **`workspace.*`** — 创建、更新、删除和列出工作空间
- **`member.*`** — 邀请、移除和管理工作空间成员
- **`user.*`** — 个人资料管理和密码修改

## 开发

### 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run start        # 启动生产服务器
npm run lint         # 运行 ESLint
npx vitest run       # 运行所有测试
npx vitest run --watch  # 监听模式
npx prisma studio    # 打开 Prisma Studio
```

### 添加测试

测试位于 `src/__tests__/`，使用 Vitest。需模拟外部依赖（Prisma、Yjs）以保持测试快速和隔离。

```bash
npx vitest run src/__tests__/auth.test.ts  # 运行单个测试文件
```

## 许可证

MIT
