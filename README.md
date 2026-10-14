# MedCare - 家庭健康管理系统（v2）

全栈家庭健康管理应用：成员为全局资源，多账户经邀请码注册、认领或授权共享成员，集中管理医疗报告与健康指标。

## 功能

- **多账户与角色** - admin / member 双角色；首个注册账户自动成为 admin
- **邀请码注册** - admin 生成邀请码（通用码 / 绑定专属成员的专属码），支持次数与有效期限制
- **本人绑定与认领** - 注册时新建本人成员，或认领已有成员（`mode=claim`）；老账户可补绑（`bind-self`）
- **授权管理** - 成员可授权其他账户 viewer（只读）/ editor（可编辑），授权矩阵统一判定可见性与操作
- **家庭成员管理** - 维护成员基本信息、年龄、BMI；admin 可合并重复成员
- **医疗报告管理** - 上传报告附件（图片/PDF），自动 OCR 识别指标数据
- **快速上传** - 移动端拍照/选图 → OCR → 确认保存的上传向导，默认本人成员
- **健康指标库** - 内置 135+ 常用医学检验指标，支持性别差异化参考范围与 OCR 别名
- **数据可视化** - 指标趋势图表，自动标注异常值
- **PWA** - 可安装到手机主屏（App Shell 离线缓存，健康数据不缓存）
- **CLI 工具** - 命令行接口，支持自动化和 Agent 驱动操作
- **安全认证** - JWT 认证，bcrypt 密码加密，接口限流

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18, Redux Toolkit, Ant Design 5, ECharts, Vite 5, PWA (vite-plugin-pwa / Workbox) |
| 后端 | Express.js, Sequelize ORM, SQLite |
| OCR | PaddleOCR (本地), OpenAI Vision API (云端) |
| CLI | Commander.js (Agent 可通过命令行操作) |

## 快速开始

### 环境要求

- Node.js >= 18（前端 Vite 5 要求）
- npm >= 8

### 安装（新数据库）

```bash
git clone <repository-url>
cd medcare

# 安装全部依赖
npm run install-all

# 初始化数据库（直接创建 v2 结构，含默认指标库）
cd server && npm run init-db && cd ..

# 启动开发服务器（前端 3000 + 后端 3001）
npm run dev
```

首次访问 http://localhost:3000 注册首个账户，自动成为 admin 并绑定本人成员。

### 旧 v1 数据库升级

```bash
# 1. 先手动备份数据库文件（脚本亦会自动备份 *.v1-backup-<时间戳>）
cp server/database/medcare.db server/database/medcare.db.manual-backup

# 2. 迁移
cd server && npm run migrate-v2
```

迁移内容：`users` 增加 `role`/`displayName`（既有用户全部设为 admin）；创建 `user_member_links` 与 `invite_codes` 表；`family_members` 的旧 `userId`/`relationship` 数据迁入 links。

**可选 `--finalize`**（`npm run migrate-v2 -- --finalize`）：

- 作用：删除 `family_members` 的 `userId`/`relationship` 遗留列（表重建）。
- 时机：建议先以 `migrate-v2` 跑通 v2 并确认数据完整后再执行；finalize 后数据结构不再兼容 v1 代码，无法直接回退。
- 风险：表重建期间外键约束临时关闭，请在停服状态下执行（脚本会先自动备份）。

### OCR 配置（可选）

OCR 功能默认使用本地 PaddleOCR。如需使用云端识别：

1. 进入 设置 → OCR 设置
2. 选择「云端 OCR」
3. 填入 API 地址和密钥（兼容 OpenAI Vision 格式）

不配置 OCR 也可手动录入指标数据。

## 项目结构

```
medcare/
├── client/                  # React 前端（Vite 5 + PWA）
│   └── src/
│       ├── api/             # API 调用层（按资源拆分：auth/members/report/...）
│       ├── pages/           # 页面（仪表盘、报告、成员、快速上传、设置等）
│       ├── store/           # Redux 状态管理
│       ├── components/      # 布局和通用组件（含移动端 TabBar）
│       ├── hooks/           # 自定义 hooks
│       └── styles/          # 全局样式
├── server/
│   ├── src/                 # 后端源码（分层）
│   │   ├── app.js           # Express 应用组装（路由挂载）
│   │   ├── index.js         # 入口
│   │   ├── config/          # 环境变量配置
│   │   ├── controllers/     # 控制器（参数处置 + 响应）
│   │   ├── services/        # 业务逻辑（权限矩阵、迁移、OCR 引擎）
│   │   ├── models/          # Sequelize 数据模型
│   │   ├── routes/          # API 路由
│   │   ├── middleware/      # 认证、admin 门控、限流
│   │   └── utils/           # asyncHandler、HttpError、安全工具
│   ├── cli/                 # medcare CLI 工具
│   ├── scripts/             # 数据库初始化（init-db）、v1→v2 迁移（migrate-v2）
│   └── uploads/             # 上传文件存储（gitignored）
├── skills/                  # Agent 集成文档（CLI skill）
├── Dockerfile
├── docker-compose.yml
└── package.json             # 根级脚本入口
```

## Agent 集成

MedCare 内置 CLI 工具，可以让 AI Agent（如 Claude Code、Cursor 等）通过命令行操作系统数据，实现自动化的报告录入和健康管理。

### 快速上手

```bash
# 1. 安装 CLI
cd server && npm link

# 2. 登录
medcare login -s http://localhost:3001 -u <user> -p <password>
```

### 让 Agent 识别 MedCare 能力

将 `skills/medcare-cli.md` 的内容提供给 Agent 即可。具体方式取决于你使用的 Agent 平台：

- **Claude Code** — 将内容放入 `~/.claude/skills/medcare-cli/SKILL.md`
- **Cursor / Windsurf** — 写入项目的 `.cursorrules` 或 `AGENTS.md`
- **其他 Agent** — 作为系统提示或上下文注入

### 常用命令示例

```bash
# 成员（返回当前账户可见成员，含视角 role/relationship）
medcare members list
medcare members get <id>
medcare members add --name "女儿" --gender "女" --relationship "女儿"

# 邀请码（admin）
medcare invites create --uses 1 --days 7          # 通用码
medcare invites create --member <id>              # 绑定专属成员
medcare invites list

# 授权
medcare access grant --member <id> --user <id> --role viewer
medcare access revoke --member <id> --link <linkId>

# 用户（admin 额外返回角色与本人成员）
medcare users list

# 报告
medcare reports list --member <id>
medcare reports ocr --file report.jpg
medcare reports upload --member 1 --file report.jpg --date 2026-04-20 \
  --indicator-data '[{"indicatorId":1,"value":"120"}]'

# 指标库
medcare indicators list --search "白细胞"
medcare indicators add --name "新指标" --type "分类" --value-type numeric
```

详细的命令参考和工作流说明见 [`skills/medcare-cli.md`](skills/medcare-cli.md)。

## API 概览

所有接口前缀 `/api/`，需 JWT 认证（除 auth 公开路由与 health 外）。

| 路径 | 说明 |
|------|------|
| `POST /api/auth/register` | 注册（`inviteCode` + `mode=create/claim` + `memberData`/`claimMemberId`，首个账户免邀请码成为 admin） |
| `POST /api/auth/login` | 登录 |
| `GET /api/auth/me` | 当前用户 + 本人成员（selfMember） |
| `POST /api/auth/preview-invite` | 注册向导预览邀请码（专属码→成员；通用码→可认领列表） |
| `POST /api/auth/update-profile` | 更新个人资料（displayName） |
| `POST /api/auth/change-password` | 修改密码 |
| `GET /api/auth/init-status` / `GET /api/auth/verify` | 初始化状态 / Token 验证 |
| `POST /api/members/bind-self` | 老账户补绑本人成员（create/claim） |
| `GET /api/members` | 可见成员列表（附视角 `role`/`relationship`；`?claimable=1` 列出可认领成员） |
| `POST /api/members` / `GET/PUT/DELETE /api/members/:id` | 成员 CRUD（按权限矩阵） |
| `POST /api/members/merge` | 合并成员（admin） |
| `GET/POST /api/members/:id/links` | 成员授权列表 / 授权（viewer/editor/owner） |
| `DELETE /api/members/:id/links/:linkId` | 撤销授权（self link 仅 admin） |
| `/api/reports/*` | 报告 CRUD + 文件上传（按成员可见性过滤） |
| `/api/indicators/*` | 指标库 CRUD + 别名管理 |
| `/api/medications/*` | 用药记录 |
| `/api/medical-logs/*` | 医疗日志 |
| `/api/hospitals/*` | 医院 |
| `/api/ocr/*` | OCR 识别与配置 |
| `/api/files/*` | 附件读取 |
| `/api/config/*` | 系统配置 |
| `GET /api/users` | 用户列表（基础字段；admin 另含 `role`/`createdAt`/`selfMember`） |
| `PUT /api/users/:id/role` | 修改用户角色（admin） |
| `GET/POST /api/invites`、`DELETE /api/invites/:id` | 邀请码管理（admin；DELETE 为停用） |
| `GET /api/health` | 健康检查 |

## PWA 安装

前端为 PWA（`vite-plugin-pwa`，`autoUpdate`）：

- **手机**：浏览器（Chrome / Safari / Edge）访问站点 → 菜单中选择「添加到主屏幕 / 安装应用」，即可全屏独立窗口使用。
- **桌面**：Chrome / Edge 地址栏右侧的安装图标。
- App Shell 与静态资源离线缓存；健康数据接口（`/api/*`）不做缓存，离线时明确失败而非展示过期数据。

## 部署

### Docker

```bash
docker-compose up -d
# 访问 http://localhost:3000
```

镜像构建基于 `node:18`（前端构建阶段使用 Vite 5，产物复制到后端静态目录），后端运行层另含 Python + PaddleOCR。

### 手动部署

```bash
# 构建前端（Vite 产物为 client/dist）
cd client && npm run build
cp -r dist ../server/public/

# 配置环境变量
cat > server/.env << 'EOF'
NODE_ENV=production
PORT=3001
JWT_SECRET=<your-strong-secret>
JWT_EXPIRES_IN=7d
EOF

# 启动
cd server && npm start
```

## 许可证

MIT
