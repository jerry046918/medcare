# MedCare v2 重构设计

**日期**:2026-10-14
**状态**:已与用户逐节确认

## 1. 背景与目标

MedCare 是家庭健康管理系统(Express + Sequelize + SQLite 后端,React 18 + antd 5 + Redux Toolkit 前端)。当前痛点:

- **单管理员账户**:注册接口硬编码仅允许首个用户存在(`routes/auth.js`),无法多账户使用
- **无移动端体验**:固定 Sider 桌面布局,手机浏览器不可用;上传流程为桌面表单,无法快速拍照上传
- **构建工具过时**:CRA(react-scripts)已停止维护
- **后端分层不足**:routes 文件过重(业务逻辑内联),权限过滤散落为各处 `where: { userId }` 隐式条件

### 本次目标

1. **多账户访问**:邀请码注册,每个账户绑定"本人"成员,默认只见本人数据
2. **授权体系**:用户可授权他人查看/代管自己的成员;admin 可查看全部、分配权限、管理账户
3. **移动端 PWA**:完整 PWA(可安装),移动端快速上传向导(拍照 → OCR → 确认 → 保存)
4. **前后端结构优化**:后端 routes → controllers → services 分层;前端迁移 Vite、目录重组、响应式布局

### 已确认的决策记录

| 决策点 | 结论 |
|---|---|
| 数据可见性模型 | 本人 + 授权可见;admin 全局可见并可分配权限(用户选定) |
| 移动端形态 | 完整 PWA(manifest + service worker) |
| 注册方式 | 邀请码注册(admin 生成) |
| 前端构建 | 迁移 Vite,保持 JavaScript(不引入 TypeScript) |
| 成员模型 | 全局成员 + 账户-成员关联表(一人一条记录,避免数据分裂) |
| 注册时绑定本人 | 支持新建成员或**认领**已有成员(成员可能已被 admin/家人创建) |

### 非目标(明确排除)

- 消息通知、数据导入导出增强、多语言
- 更换 UI 库(保留 antd 5)
- Refresh token 机制(仅延长 JWT 过期至 30 天)
- 离线数据同步 / 离线上传队列(离线上传给出提示即可)
- 前端 TypeScript 化

## 2. 数据模型与权限体系

### 2.1 表结构变更

**`users`(变更)**

- 新增 `role`:ENUM(`admin` / `member`),默认 `member`;系统初始化时创建的首个账户自动为 `admin`
- 新增 `display_name`:STRING(50),nullable,显示名

**`family_members`(变更)——从"归属某账户"变为全局实体**

- 移除 `userId` 列(迁移后)
- 移除 `relationship` 列(关系是"查看者视角"的属性,移至关联表)
- 保留 `name` / `gender` / `birthday` / `weight` / `height`(成员客观属性)

**`user_member_links`(新)——账户↔成员多对多关联**

| 列 | 类型 | 说明 |
|---|---|---|
| `userId` | FK users | 账户 |
| `memberId` | FK family_members | 成员 |
| `role` | ENUM(`self` / `owner` / `editor` / `viewer`) | 见 2.2 |
| `relationship` | STRING(20) | 此视角下的关系称谓(本人/父亲/母亲…) |

- 唯一约束 `(userId, memberId)`
- `self` link:每个账户**必有且仅有 1 条**(注册时建立);每条成员**最多 1 条**(一人只能被认领一次)

**`invite_codes`(新)**

| 列 | 说明 |
|---|---|
| `code` | 唯一,admin 生成 |
| `createdById` | FK users(admin) |
| `memberId` | nullable;预关联成员则为**专属码**(注册时直接认领该成员) |
| `maxUses` / `usedCount` | 默认 1 / 0 |
| `expiresAt` | nullable |
| `active` | 默认 true |

### 2.2 link 角色语义

| 角色 | 含义 | 约束 |
|---|---|---|
| `self` | "我就是这个人"——本人 | 每账户 1 条;每成员最多 1 条 |
| `owner` | "我替这个人管数据"——代管理者(成员未注册时代建,注册后保留) | 一成员可多个 |
| `editor` | 被授权可编辑(含代传报告) | 由授权产生 |
| `viewer` | 被授权只读 | 由授权产生 |

**演变场景**:A 注册后创建成员"爸"(A 为 `owner`)→ 爸凭专属邀请码注册并认领该成员(爸为 `self`,A 的 `owner` 保留)→ 全程"爸"仅一条记录,报告与指标趋势完整。

### 2.3 权限矩阵

| 操作 | self | owner | editor | viewer | admin |
|---|:-:|:-:|:-:|:-:|:-:|
| 查看成员/报告/指标 | ✅ | ✅ | ✅ | ✅ | ✅(全部成员) |
| 上传/编辑/删除报告 | ✅ | ✅ | ✅ | ❌ | ✅ |
| 编辑成员资料 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 删除成员 | ❌ | ✅ | ❌ | ❌ | ✅ |
| 授权他人访问该成员 | ✅ | ✅ | — | — | ✅(任意授权) |
| 生成/管理邀请码 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 账户管理/角色切换 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 成员合并 | ❌ | ❌ | ❌ | ❌ | ✅ |

注:删除成员时,若该成员存在 `self` link 则任何人(含 admin)不可删除——本人账户仍绑定着;需先解除该账户的本人绑定。

### 2.4 注册与认领流程

**注册(凭邀请码)两步**:

1. 设置用户名/密码
2. 绑定本人,二选一:
   - **创建新成员**:填姓名/性别/生日 → 新建全局成员 + `self` link
   - **认领已有成员**:列出系统中**尚无 `self` link** 的成员 → 选中确认 → 建立 `self` link,该成员原有 `owner` links 全部保留

**专属邀请码**:`invite_codes.memberId` 预关联成员时,注册第二步直接显示"将绑定为:<成员名>"并只需确认——防止认领错人,是 admin 的推荐用法。通用码则自由选择新建/认领。

- 进入系统的唯一途径是 admin 生成的邀请码,认领不设审批(唯一 self 约束兜底一人一次)
- 通用码注册时,认领列表只展示无 self link 的成员

- **首个账户(系统初始化)**:同样走两步流程(账号密码 + 绑定本人),免邀请码,自动获得 `admin` 角色

**重复兜底**:若用户未认领而新建了重复成员,admin 使用「成员合并」工具(选定 source/target,将 source 的报告、指标数据、日志、links 迁移至 target,删除 source)。

### 2.5 授权操作

- 对某成员持有 `self` 或 `owner` link 的用户,可将该成员授权给其他账户,角色限 `viewer` / `editor`
- admin 可对任意成员设置任意授权(含 `owner`,含转移 `self` 绑定用于纠错/换绑)
- 撤销授权 = 删除对应 link

## 3. 后端设计

### 3.1 目录结构

```
server/
├── src/
│   ├── index.js          # 启动入口:连接 DB → 启动监听
│   ├── app.js            # Express app 工厂:中间件、路由挂载、错误处理
│   ├── config/           # 环境配置(现有迁移)
│   ├── models/           # Sequelize 模型 + 关联(现有 + UserMemberLink + InviteCode)
│   ├── middleware/       # authenticateToken、requireAdmin(新)、errorHandler(从 index.js 抽出)
│   ├── controllers/      # HTTP 层:参数校验 → 调 service → 格式化响应
│   ├── services/         # 业务逻辑(见 3.2)
│   ├── routes/           # 纯路由定义,每文件 <20 行
│   └── utils/            # security.js、HttpError、asyncHandler
├── cli/                  # CLI 同步适配新 API
└── scripts/              # initDatabase、migrate-v2
```

### 3.2 分层规则与 services

- **routes**(薄):路径 → controller 方法
- **controllers**:参数校验(sanitize/validate)→ 调 service → 统一响应格式;无业务逻辑、不直接访问模型
- **services**:业务逻辑 + 事务 + 权限断言;**权限检查统一入口 `accessService.assertAccess(userId, memberId, level)`**,替代散落的 `where: { userId }` 隐式过滤——权限矩阵的权威实现点,可单测
- **models**:Sequelize 模型与关联

services 清单:

| service | 职责 |
|---|---|
| `accessService`(新) | 权限矩阵断言、getVisibleMembers(userId)、授权/撤销 link 管理 |
| `inviteService`(新) | 邀请码生成/校验/消费(事务内 usedCount 递增) |
| `memberService`(新) | 成员 CRUD、认领、合并 |
| `reportService`(新) | 从 routes/reports.js 抽出报告业务 |
| `ocrService`(现有) | 不变 |
| `indicatorParserService`(现有) | 不变 |

### 3.3 错误处理

- 统一 `HttpError(status, message)` 业务异常类
- `asyncHandler(fn)` 包装消除 controller try/catch 样板
- 全局 errorHandler middleware(含现有 Multer 文件超限、限流 429 分支;生产环境隐藏错误详情)

### 3.4 API 变更一览

| 路径 | 方法 | 变化 | 权限 |
|---|---|---|---|
| `/api/auth/register` | POST | body 增加 `inviteCode`、`mode: create/claim`、`memberData` 或 `claimMemberId`;首个账户初始化逻辑保留(无邀请码,创建 admin) | 公开 |
| `/api/auth/login` | POST | 不变 | 公开 |
| `/api/auth/me` | GET | **新**:返回账户 + role + 本成员信息 | 登录 |
| `/api/auth/init-status` | GET | 不变(needsSetup = 无用户) | 公开 |
| `/api/auth/preview-invite` | POST | **新**:注册前校验邀请码;专属码返回 `{ boundMember }`,通用码返回 `{ claimableMembers: [...] }`(无 self link 的成员) | 公开 |
| `/api/auth/update-profile` | POST | **新**:修改自己的 `displayName` | 登录 |
| `/api/members`(原 `/api/family-members`) | GET | 列表 = 当前用户可见成员,每项附 `role`/`relationship`(当前视角) | 登录 |
| `/api/members` | POST | 创建成员(自动建 `owner` link) | 登录 |
| `/api/members/:id` | GET/PUT/DELETE | 权限按矩阵(2.3) | 按矩阵 |
| `/api/members/:id/links` | GET/POST | 查看授权列表;授权 `{granteeUserId, role: viewer/editor}` | self/owner/admin |
| `/api/members/:id/links/:linkId` | DELETE | 撤销授权 | self/owner/admin |
| `/api/members/merge` | POST | `{sourceId, targetId}` 合并重复成员 | admin |
| `/api/members/bind-self` | POST | **新**:登录态补绑本人(迁移后无 self link 的老账户;规则同注册认领:`{mode, memberData? | claimMemberId?}`) | 登录且尚无 self |
| `/api/invites` | GET/POST | 邀请码列表/创建(`maxUses`、`expiresAt`、`memberId` 可选) | admin |
| `/api/invites/:id` | DELETE | 停用邀请码 | admin |
| `/api/users` | GET | 账户列表;登录即可(返回 id/username/displayName 基础字段,供授权选人),admin 额外获得 role/createdAt/selfMember | 登录 |
| `/api/users/:id/role` | PUT | 切换 admin/member | admin |
| `/api/reports` 等 | — | 路径不变,内部权限检查改走 accessService;列表接口校验各成员可见性 | 按矩阵 |
| `/api/medications`、`/api/medical-logs` | — | 同上,权限检查改走 accessService | 按矩阵 |
| `/api/indicators`、`/api/ocr`、`/api/config`、`/api/files` | — | 路径与权限逻辑基本不变 | 登录 |

**CLI**:现有命令保持可用(路径 `/api/family-members` → `/api/members` 同步更新);新增 `medcare invites create`、`medcare access grant/revoke`。

### 3.5 数据迁移(`scripts/migrate-v2.js`)

1. 备份 `.db` 文件(带时间戳)
2. `users` 加 `role`/`display_name`;现有唯一用户设为 `admin`
3. 建 `user_member_links`:遍历现有 `family_members.userId` → `owner` link(relationship 复制原值);原 `relationship='本人'` 的记录 → `self` link,同时确保该用户 self 唯一
4. `family_members` 移除 `userId`/`relationship` 列(SQLite 表重建:建新表 → INSERT SELECT → DROP → RENAME)
5. 建 `invite_codes` 表
6. 幂等:检测到 `user_member_links` 已存在则跳过并提示

启动时 `sequelize.sync({ force: false })` 仅负责新建表;列变更一律走迁移脚本。

## 4. 前端设计

### 4.1 构建迁移(CRA → Vite)

- 依赖:`vite` + `@vitejs/plugin-react` + `vite-plugin-pwa`(Workbox)
- `index.html` 移至 `client/` 根;dev proxy 从 package.json 的 `proxy` 字段迁至 `vite.config.js`(`/api` → `http://localhost:3001`)
- 环境变量 `REACT_APP_*` → `VITE_*`(如有)
- 构建产物仍为静态文件,生产部署继续拷贝至 `server/public`

### 4.2 目录结构

```
client/src/
├── main.jsx
├── App.jsx
├── api/            # axios 实例 + 模块化 API(改名自 services/,避免与后端 services 概念混淆)
├── store/          # RTK slices(familyMembers → members 改造;新增 invites)
├── components/
│   ├── layout/     # AppLayout:桌面 Sider / 移动端底部 TabBar,useBreakpoint 切换
│   └── common/     # HospitalAutoComplete 等现有通用组件迁移
├── pages/
├── hooks/          # useBreakpoint、useVisibleMembers 等
└── utils/
```

### 4.3 响应式布局

- **桌面(≥768px)**:保留现有 Sider 布局与视觉风格
- **移动端(<768px)**:窄 Header(页面标题 + 头像)+ 底部 TabBar:首页 · 报告 · **[⬆ 上传]** · 成员 · 我的(上传按钮居中突出)
- 列表页:桌面 Table / 移动端 Card 列表切换
- 表单单列;触摸目标 ≥44px;ECharts 图表容器 resize 自适应

### 4.4 快速上传向导(路由 `/upload/quick`,移动优先)

```
① 点上传按钮 → 直接唤起相机/相册(input capture="environment",支持多选)
② 自动 OCR → 识别中(进度反馈)
③ 确认页:指标列表(可编辑/增删)
   成员选择器 → 默认【本人】(账户 self 绑定,可切换其他可见成员)
   日期默认今天;医院/备注折叠为可选
④ 保存成功 → 「再拍一张」(多页报告)或「完成」
```

- 桌面端保留现有完整表单上传页(`/reports/upload`),两入口并存互链
- 复用现有 OCR 确认组件逻辑(指标匹配/编辑),抽取为共享组件

### 4.5 PWA

- **Manifest**:name「MedCare」、`display: standalone`、主题色(与现有品牌色 #3b82f6/#06b6d4 一致)、192/512 + maskable 图标、iOS `apple-touch-icon` 与启动屏参数
- **Service Worker(Workbox)**:
  - App shell(JS/CSS/图标):build 时 precache
  - 页面导航请求:NetworkFirst → 离线回退缓存的 index.html(离线可打开 App 壳)
  - `/api/*`:NetworkOnly(健康数据不做离线缓存;离线上传给出明确错误提示)
- **登录态**:JWT 过期默认调至 30 天(`JWT_EXPIRES_IN`,.env 可改);首次移动端访问显示一次性「添加到主屏幕」引导(iOS 需手动操作引导)

### 4.6 设置页扩展(按角色动态显示)

| 区块 | 可见者 |
|---|---|
| 账户信息(用户名/显示名/改密码) | 所有人 |
| 本人绑定状态(查看当前 self 成员) | 所有人 |
| 我的授权(我授权他人的列表 + 撤销;我被授权的列表) | 所有人 |
| 邀请码管理(生成/停用,可生成专属码) | admin |
| 账户管理(列表/角色切换) | admin |
| 成员合并工具 | admin |

### 4.7 前端其他调整

- `authSlice` 扩展:存储 role、self member;`GET /api/auth/me` 启动时拉取
- 成员相关 slice/api 改名 `members`,响应结构含视角 `role`/`relationship`
- 登录后默认视图:Dashboard 默认展示**本人**数据(成员筛选默认 self)

## 5. 测试策略

- **后端单测**(优先级最高,权限是核心风险):
  - `accessService`:权限矩阵全组合断言(self/owner/editor/viewer/admin × 各操作)
  - `inviteService`:生成/过期/次数耗尽/并发消费
  - `memberService`:认领唯一性、合并迁移完整性
  - 测试框架:`node:test` + `supertest`(不引入新依赖 jest,保持轻量;若项目已有约定可调整)
- **后端集成测试**:注册(两种 mode)、授权后可见性变化、报告 CRUD 跨权限场景
- **前端**:vitest 快速上传向导流程测试(步骤流转/默认成员);现有 CRA 测试迁移或删除(现仅脚手架残留)
- **手动验收清单**:iOS Safari / Android Chrome 访问、PWA 安装、相机拍照上传、离线打开壳、邀请码全流程、授权可见性变化

## 6. 实施阶段(供实施计划拆解)

1. **后端结构重组**:`server/src/` 分层迁移,routes → controllers/services 抽取,行为不变(现有 API 全等)
2. **数据模型 + 迁移**:新模型、migrate-v2 脚本、备份机制
3. **认证与邀请码**:register 改造(两种 mode)、邀请码 CRUD、init 流程适配 admin
4. **授权体系**:accessService 矩阵 + links API + 成员合并
5. **前端 Vite 迁移**:构建切换、目录重组、行为不变
6. **响应式布局**:AppLayout 双形态、列表/表单/图表适配
7. **快速上传向导** + OCR 确认组件抽取
8. **PWA**:manifest/SW/安装引导
9. **设置页扩展 + CLI 更新**
10. **测试补全 + README/skill 文档更新**

每个阶段保持可运行、可验证,阶段末提交。
