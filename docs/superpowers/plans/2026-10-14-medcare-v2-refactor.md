# MedCare v2 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-10-14-medcare-v2-refactor-design.md` 重构 MedCare:多账户(邀请码+认领)、授权体系、Vite 前端、移动端 PWA 快速上传、后端分层。

**Architecture:** 后端重组为 `server/src/`(routes→controllers→services),权限统一由 `accessService` 断言;数据模型改为全局成员 + `user_member_links` 关联表;前端迁移 Vite + 响应式布局 + PWA + 快速上传向导。

**Tech Stack:** Express 4 / Sequelize 6 / SQLite;React 18 / Redux Toolkit / antd 5 / Vite 5 / vite-plugin-pwa;测试用 node:test + supertest(后端)、vitest(前端)。

**Spec:** `docs/superpowers/specs/2026-10-14-medcare-v2-refactor-design.md`(实施前必读)

## Global Constraints

- Node >= 18(使用 node:test);包管理 npm;不引入 TypeScript、Jest、新 ORM
- 所有 API 响应包:`{ success: boolean, message?: string, data?: any }`
- `/api/family-members` 旧路径以别名保留至 Task 23 才移除(期间双挂载)
- JWT 过期默认 `30d`(config 默认值 + `.env.example` 注释)
- 新模型字段 camelCase(与现有 DB 风格一致,不开 underscored)
- 移动端断点 768px;触摸目标 ≥44px
- 测试隔离:`NODE_ENV=test` 时所有限流中间件直通;`MEDCARE_DB_PATH` 环境变量覆盖 DB 路径(测试用 `:memory:`)
- 每个 commit 用 conventional commits,结尾加 `Co-Authored-By: Claude Code <noreply@anthropic.com>`
- 迁移脚本幂等,运行前自动备份 DB 文件;Task 8 结束后、Task 14 结束后各在开发库上运行一次
- 阶段顺序不可调换:后端 Task 1-14 → 前端 Task 15-23;每个 Task 结束时项目可启动、全部测试绿

## Review Focus

1. **邀请码超发**(两请求同时消费最后剩余次数)→ `inviteService.consumeInvite` 必须用条件更新(`WHERE usedCount < maxUses`)而非先读后写;Task 9 测试覆盖"耗尽后第 3 次注册被拒"。
2. **成员重复认领**(第二人 claim 已有 self link 的成员)→ 事务内重查 self link,冲突返回 409;Task 10 测试覆盖。
3. **越权**(viewer 上传报告 / editor 改成员资料)→ `accessService.assertAccess` 矩阵;Task 7 全矩阵单测 + Task 14 reports 集成测试覆盖。
4. **迁移完整性**(v1 库遗漏数据 / 重复运行崩溃)→ Task 8 幂等测试:迁移两次、断言 links 数量 = v1 members 数、admin 角色就位、备份文件生成。
5. **移动端 OCR 慢/失败卡死向导** → 快速上传 stage 机 `reduceStage`(utils 纯函数)识别失败可重试且不丢文件;Task 19 vitest 覆盖。

---

### Task 1: 测试基础设施 + `server/src/` 骨架迁移(行为不变)

**Files:**
- Create: `server/src/index.js`、`server/src/app.js`
- Create: `server/tests/helpers/app.js`、`server/tests/health.test.js`
- Move(内容原样搬移): `server/config` → `server/src/config`;`server/models` → `server/src/models`;`server/middleware` → `server/src/middleware`;`server/utils` → `server/src/utils`;`server/services` → `server/src/services`(ocrService、indicatorParserService、paddle_ocr_worker.py 一起搬)
- Modify: `server/package.json`(scripts 加 test;devDeps 加 supertest)
- Modify: `server/index.js`(改为 3 行 shim)
- Delete: 搬移后的旧目录

**Interfaces:**
- Produces: `createApp()`(server/src/app.js 导出,无参,返回配置完整的 express app);`server/src/models`、`server/src/middleware`、`server/src/utils` 模块路径(后续 Task 一律 require 这些路径)
- Consumes: 现有 routes/(此 Task 暂不搬 routes,原样可用)

- [ ] **Step 1: 安装测试依赖**

```bash
cd server && npm install --save-dev supertest
```

`server/package.json` scripts 增加:
```json
"test": "node --test tests/",
"test:watch": "node --test --watch tests/"
```

- [ ] **Step 2: 搬移目录并修 require**

```bash
cd server
git mv config src/config && git mv models src/models && git mv middleware src/middleware && git mv utils src/utils && git mv services src/services
```

逐文件修正 require 相对路径(原 `../config` → `../config` 不变,因为层级相同;但 `server/routes/*.js` 引用 `../models` → `../src/models`;`server/cli/medcare.js` 若引用服务内部模块同步修改)。重点检查:
- `routes/*.js`:`require('../models')` → `require('../src/models')`,`../middleware`、`../utils`、`../services` 同理
- `src/config/index.js`:`storage` 与 `uploadDir` 的 `__dirname` 相对路径从 `../database`、`../uploads` 改为 `../../database`、`../../uploads`
- `src/services/ocrService.js` 中对 python 脚本路径的 `__dirname` 引用(`paddle_ocr_worker.py` 已随目录搬移,路径深度不变则不改;逐一核对)
- `scripts/*.js` 中对 models/config 的 require 同步更新

- [ ] **Step 3: 写 app 工厂与启动入口**

`server/src/app.js`:
```js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { server: serverConfig } = require('./config');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

// 路由(本 Task 仍指向旧 routes/,Task 3-5 逐个换为新结构)
const authRoutes = require('../routes/auth');
const familyMemberRoutes = require('../routes/familyMembers');
const reportRoutes = require('../routes/reports');
const indicatorRoutes = require('../routes/indicators');
const medicationRoutes = require('../routes/medications');
const medicalLogRoutes = require('../routes/medicalLogs');
const hospitalRoutes = require('../routes/hospitals');
const ocrRoutes = require('../routes/ocr');
const configRoutes = require('../routes/config');
const fileRoutes = require('../routes/files');

function createApp() {
  const app = express();
  app.use(cors({
    origin: serverConfig.nodeEnv === 'production' ? (process.env.CORS_ORIGIN || false) : true,
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'");
    next();
  });
  app.use('/api/files', fileRoutes);
  app.use('/api/', apiLimiter);
  const publicPath = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }
  app.use('/api/auth', authRoutes);
  app.use('/api/family-members', familyMemberRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/indicators', indicatorRoutes);
  app.use('/api/medications', medicationRoutes);
  app.use('/api/medical-logs', medicalLogRoutes);
  app.use('/api/hospitals', hospitalRoutes);
  app.use('/api/ocr', ocrRoutes);
  app.use('/api/config', configRoutes);
  app.get('/api/health', (req, res) => res.json({ status: 'OK', message: '家庭医疗管理系统服务正常运行' }));
  app.use('/api/*', (req, res) => res.status(404).json({ success: false, message: '接口不存在' }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
```

`server/src/index.js`(承接原 index.js 启动逻辑,删除 app 定义):
```js
require('dotenv').config();
const { server: serverConfig, checkRequiredEnvVars } = require('./config');
const { sequelize } = require('./models');
const { createApp } = require('./app');

checkRequiredEnvVars();
const app = createApp();

(async () => {
  try {
    await sequelize.sync({ force: false });
    app.listen(serverConfig.port, () => {
      console.log(`服务器运行在端口 ${serverConfig.port}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
})();
```

`server/index.js` 整体替换为 shim:
```js
require('./src/index.js');
```

- [ ] **Step 4: 抽出 errorHandler + 限流测试直通**

`server/src/middleware/errorHandler.js`(从原 index.js 的全局错误处理迁移,新增 HttpError 分支;Multer/429 分支原样保留):
```js
const { server: serverConfig } = require('../config');
const HttpError = require('../utils/httpError');

function errorHandler(err, req, res, next) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: '文件大小超过限制（最大 10MB）' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: '意外的文件字段' });
  }
  if (err.status === 429) {
    return res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  console.error('服务器错误:', err);
  const message = serverConfig.nodeEnv === 'production' ? '服务器内部错误' : (err.message || '服务器内部错误');
  res.status(err.status || 500).json({ success: false, message });
}

module.exports = { errorHandler };
```

`server/src/utils/httpError.js`:
```js
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
module.exports = HttpError;
```

`server/src/utils/asyncHandler.js`:
```js
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
```

`server/src/middleware/rateLimiter.js` 顶部加测试直通(apiLimiter 与 authLimiter、ocrLimiter 定义处都要):
```js
const noop = (req, res, next) => next();
const disabled = process.env.NODE_ENV === 'test';
// 导出处:module.exports = { apiLimiter: disabled ? noop : apiLimiter, ... }
```

`server/src/config/index.js` DB storage 改为可覆盖:
```js
storage: process.env.MEDCARE_DB_PATH || path.join(__dirname, '../../database/medcare.db'),
```

- [ ] **Step 5: 写测试助手 + 冒烟测试**

`server/tests/helpers/app.js`:
```js
process.env.NODE_ENV = 'test';
process.env.MEDCARE_DB_PATH = ':memory:';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { sequelize } = require('../../src/models');

let appPromise = null;
function getTestApp() {
  if (!appPromise) {
    appPromise = sequelize.sync({ force: true }).then(() => createApp());
  }
  return appPromise;
}
// 注册首个管理员(旧版注册协议:username/password;Task 10 后更新为新协议)
async function createAdmin() {
  const app = await getTestApp();
  const res = await request(app).post('/api/auth/register')
    .send({ username: 'admin', password: 'pass123456' });
  if (res.status !== 201) throw new Error(`createAdmin 失败: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.data.token, userId: res.body.data.user.id };
}
function auth(agent, token) {
  return agent.set('Authorization', `Bearer ${token}`);
}
module.exports = { getTestApp, createAdmin, auth, request };
```

`server/tests/health.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, request } = require('./helpers/app');

test('GET /api/health 返回 OK', async () => {
  const app = await getTestApp();
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'OK');
});

test('未知 API 返回 404 包结构', async () => {
  const app = await getTestApp();
  const res = await request(app).get('/api/nope');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.success, false);
});
```

**测试隔离说明**(执行者必读):`node --test` 为**每个测试文件启动独立进程**,各文件持有独立的 `:memory:` 库;同一文件内共享一个库——用唯一的 username/姓名避免冲突,勿跨文件假设数据。

- [ ] **Step 6: 运行测试与手动冒烟**

```bash
cd server && npm test
```
Expected: 全部 PASS。再手动 `npm run dev` 确认服务器可启动、`curl localhost:3001/api/health` 返回 OK。

- [ ] **Step 7: Commit**

```bash
git add -A server
git commit -m "refactor(server): extract src/ skeleton with app factory, error handler, test infra"
```

### Task 2: memberService + members 控制器(行为不变重构)

**Files:**
- Create: `server/src/services/memberService.js`、`server/src/controllers/membersController.js`、`server/src/routes/members.js`
- Test: `server/tests/members.test.js`
- Modify: `server/src/app.js`(挂载新路由替换旧 familyMembers)
- Delete: `server/routes/familyMembers.js`

**Interfaces:**
- Produces: `memberService.listByUser(userId)` → 成员数组(含 age/bmi/reportCount);`memberService.getById(userId, id)`;`memberService.create(userId, data)`;`memberService.update(userId, id, data)`;`memberService.remove(userId, id)`(本 Task 内部仍是 userId 归属过滤,Task 10 换 accessService)
- Consumes: Task 1 的 asyncHandler、errorHandler

- [ ] **Step 1: 写集成测试(锁定现有行为)**

`server/tests/members.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, auth, request } = require('./helpers/app');

async function setup() {
  const app = await getTestApp();
  const { token } = await createAdmin();
  return { app, token };
}

test('创建成员→列表→详情→更新→删除 全流程', async () => {
  const { app, token } = await setup();
  const create = await auth(request(app).post('/api/family-members'), token)
    .send({ name: '测试人', gender: '男', relationship: '本人', birthday: '1990-01-01' });
  assert.strictEqual(create.status, 201);
  const id = create.body.data.id;

  const list = await auth(request(app).get('/api/family-members'), token);
  assert.strictEqual(list.status, 200);
  assert.ok(list.body.data.some(m => m.name === '测试人'));

  const detail = await auth(request(app).get(`/api/family-members/${id}`), token);
  assert.strictEqual(detail.status, 200);
  assert.strictEqual(detail.body.data.name, '测试人');

  const upd = await auth(request(app).put(`/api/family-members/${id}`), token)
    .send({ weight: 70 });
  assert.strictEqual(upd.status, 200);

  const del = await auth(request(app).delete(`/api/family-members/${id}`), token);
  assert.strictEqual(del.status, 200);
});

test('未认证访问被拒', async () => {
  const { app } = await setup();
  const res = await request(app).get('/api/family-members');
  assert.strictEqual(res.status, 401);
});

test('无效输入返回 400', async () => {
  const { app, token } = await setup();
  const res = await auth(request(app).post('/api/family-members'), token)
    .send({ name: '', gender: '男', relationship: '本人' });
  assert.strictEqual(res.status, 400);
});
```

注意:本 Task 中 createAdmin 依赖旧注册协议(首账户免邀请码),与 helper 一致。测试间共享同一 `:memory:` 库,用唯一姓名避免相互干扰。

- [ ] **Step 2: 运行确认测试通过(针对旧路由)**

```bash
cd server && npm test
```
Expected: PASS(旧实现本身满足)。

- [ ] **Step 3: 抽 service 与 controller**

`server/src/services/memberService.js`:把 `routes/familyMembers.js` 中的 DB 逻辑(sanitizeMemberData、findAll/findOne/create/update/destroy、getAge/getBMI 计算)原样移入,导出 5 个方法;校验错误改抛 `HttpError(400, 原消息)`、找不到抛 `HttpError(404, '家庭成员不存在')`。

`server/src/controllers/membersController.js`:
```js
const asyncHandler = require('../utils/asyncHandler');
const memberService = require('../services/memberService');

exports.list = asyncHandler(async (req, res) => {
  const data = await memberService.listByUser(req.user.id);
  res.json({ success: true, data });
});
exports.getDetail = asyncHandler(async (req, res) => {
  const data = await memberService.getById(req.user.id, req.params.id);
  res.json({ success: true, data });
});
exports.create = asyncHandler(async (req, res) => {
  const data = await memberService.create(req.user.id, req.body);
  res.status(201).json({ success: true, message: '家庭成员创建成功', data });
});
exports.update = asyncHandler(async (req, res) => {
  const data = await memberService.update(req.user.id, req.params.id, req.body);
  res.json({ success: true, message: '家庭成员更新成功', data });
});
exports.remove = asyncHandler(async (req, res) => {
  await memberService.remove(req.user.id, req.params.id);
  res.json({ success: true, message: '家庭成员删除成功' });
});
```

`server/src/routes/members.js`:
```js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/membersController');
const router = express.Router();
router.get('/', authenticateToken, c.list);
router.get('/:id', authenticateToken, c.getDetail);
router.post('/', authenticateToken, c.create);
router.put('/:id', authenticateToken, c.update);
router.delete('/:id', authenticateToken, c.remove);
module.exports = router;
```

`server/src/app.js`:删除 `familyMemberRoutes` 引用,换 `require('./routes/members')`,挂载 `app.use('/api/family-members', memberRoutes);`(Task 10 改为双路径)。

- [ ] **Step 4: 运行测试通过后提交**

```bash
cd server && npm test
git add -A server && git commit -m "refactor(server): members routes split into controller/service with tests"
```

### Task 3: reportService + reports 控制器(行为不变重构)

**Files:**
- Create: `server/src/services/reportService.js`、`server/src/controllers/reportsController.js`、`server/src/routes/reports.js`
- Test: `server/tests/reports.test.js`
- Modify: `server/src/app.js`
- Delete: `server/routes/reports.js`

**Interfaces:**
- Produces: `reportService.listByUser(userId)`;`reportService.getById(userId, id)`;`reportService.create(userId, body, file)`;`reportService.update(userId, id, body, file?)`;`reportService.remove(userId, id)`;multer 实例 `reportUpload` 从 service 导出挂路由
- Consumes: Task 2 的 memberService(报告归属校验仍走 userId 过滤,Task 13 换)

- [ ] **Step 1: 写集成测试**

`server/tests/reports.test.js`(覆盖:建成员→传报告(带指标)→列表→详情→更新→删除;无成员 400;文件类型校验):
```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { getTestApp, createAdmin, auth, request } = require('./helpers/app');

async function setup() {
  const app = await getTestApp();
  const { token } = await createAdmin();
  const member = await auth(request(app).post('/api/family-members'), token)
    .send({ name: '报告对象', gender: '女', relationship: '配偶' });
  return { app, token, memberId: member.body.data.id };
}

// 1x1 红色 PNG
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('报告全流程', async () => {
  const { app, token, memberId } = await setup();
  const create = await auth(request(app).post('/api/reports'), token)
    .field('familyMemberId', String(memberId))
    .field('reportDate', '2026-10-01')
    .field('hospitalName', '测试医院')
    .field('indicatorData', JSON.stringify([{ indicatorId: null, value: '5.0', notes: '手动' }]))
    .attach('reportFile', png, { filename: 'r.png', contentType: 'image/png' });
  assert.strictEqual(create.status, 201);
  const id = create.body.data.id;

  const list = await auth(request(app).get('/api/reports'), token);
  assert.strictEqual(list.status, 200);
  assert.ok(Array.isArray(list.body.data));

  const detail = await auth(request(app).get(`/api/reports/${id}`), token);
  assert.strictEqual(detail.status, 200);

  const del = await auth(request(app).delete(`/api/reports/${id}`), token);
  assert.strictEqual(del.status, 200);
});

test('缺成员/日期返回 400', async () => {
  const { app, token } = await setup();
  const res = await auth(request(app).post('/api/reports'), token)
    .field('reportDate', '2026-10-01');
  assert.strictEqual(res.status, 400);
});
```
注:字段名与现有 `routes/reports.js` 的 POST 处理保持一致(以现有代码为准,`familyMemberId`/`reportDate`/`indicatorData`/`reportFile`;若实际实现不同,以现有实现为准修正测试)。

- [ ] **Step 2: 对照旧路由运行,测试通过**

```bash
cd server && npm test
```

- [ ] **Step 3: 抽 service/controller/routes**

`reportService.js` 迁移内容:multer storage 配置、`sanitizeReportData`、`withTransaction`(保留)、全部查询/事务逻辑;错误统一 `HttpError`。controller 只做 req→参数映射;`POST /` 路由挂 `reportUpload.single('reportFile')` 再进 controller。app.js 换挂载。

- [ ] **Step 4: 测试通过后提交**

```bash
cd server && npm test
git add -A server && git commit -m "refactor(server): reports split into controller/service with tests"
```

### Task 4: 其余路由迁移(auth/config/indicators/medications/medicalLogs/hospitals/ocr/files)

**Files:**
- Create: `server/src/controllers/{authController,configController,indicatorsController,medicationsController,medicalLogsController,hospitalsController,ocrController,filesController}.js`
- Create: `server/src/routes/{auth,config,indicators,medications,medicalLogs,hospitals,ocr,files}.js`
- Create: `server/tests/smoke-all-routes.test.js`
- Modify: `server/src/app.js`
- Delete: `server/routes/`(全部旧文件)

**Interfaces:**
- Produces: `server/src/routes/*` 全部新路由(app.js 仅挂载 src/routes)
- Consumes: Task 1-3 模式

- [ ] **Step 1: 写冒烟测试**

`server/tests/smoke-all-routes.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, auth, request } = require('./helpers/app');

test('auth: 登录成功与失败', async () => {
  const app = await getTestApp();
  await createAdmin();
  const ok = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'pass123456' });
  assert.strictEqual(ok.status, 200);
  const bad = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
  assert.strictEqual(bad.status, 401);
});

test('indicators/hospitals/config/ocr 基本可用', async () => {
  const app = await getTestApp();
  const { token } = await createAdmin();
  const ind = await auth(request(app).get('/api/indicators'), token);
  assert.strictEqual(ind.status, 200);
  const hos = await auth(request(app).get('/api/hospitals/provinces'), token);
  assert.strictEqual(hos.status, 200);
  const cfg = await auth(request(app).get('/api/config'), token);
  assert.strictEqual(cfg.status, 200);
  const engines = await auth(request(app).get('/api/ocr/engines'), token);
  assert.strictEqual(engines.status, 200);
});

test('medications/medicalLogs CRUD 最小路径', async () => {
  const app = await getTestApp();
  const { token } = await createAdmin();
  const member = await auth(request(app).post('/api/family-members'), token)
    .send({ name: '用药对象', gender: '男', relationship: '儿子' });
  const mid = member.body.data.id;
  const med = await auth(request(app).post('/api/medications'), token)
    .send({ memberId: mid, name: '维生素C', dosage: '1粒', frequency: '每日一次' });
  assert.strictEqual(med.status, 201);
  const log = await auth(request(app).post('/api/medical-logs'), token)
    .send({ memberId: mid, logType: '就诊', content: '普通感冒复诊', logDate: '2026-10-01' });
  assert.strictEqual(log.status, 201);
});
```
注:POST 字段以现有 `routes/medications.js`、`routes/medicalLogs.js` 实际要求为准修正。

- [ ] **Step 2: 逐文件迁移(模式同 Task 2/3)**

| 旧文件 | → controller | 备注 |
|---|---|---|
| routes/auth.js | authController | **逻辑原样**(register 仍限首账户,Task 9 重写);verify/change-password/init-status 保留 |
| routes/config.js | configController | SystemConfig CRUD 原样 |
| routes/indicators.js | indicatorsController | 含 alias 端点原样 |
| routes/medications.js | medicationsController | userId 过滤暂留(Task 13 换) |
| routes/medicalLogs.js | medicalLogsController | 同上 |
| routes/hospitals.js | hospitalsController | 纯读,直接搬 |
| routes/ocr.js | ocrController | multer 实例随 controller;`paddle_ocr_worker.py` 引用路径核对 |
| routes/files.js | filesController | validatePath 流文件原样 |

迁移规则:业务/DB 逻辑多的(auth/config/indicators/medications/medicalLogs)抽 service(`authService`、`configService`、`indicatorService`、`medicationService`、`medicalLogService`);逻辑极薄的(hospitals/files/ocr 的部分端点)允许 controller 直连 model,不强造空壳 service。

- [ ] **Step 3: 更新 app.js 挂载 + 删除 server/routes/ 全部旧文件**

- [ ] **Step 4: 测试通过后提交**

```bash
cd server && npm test
git add -A server && git commit -m "refactor(server): migrate remaining routes to controllers/services"
```

### Task 5: 模型层 v2(新模型 + buildModels)

**Files:**
- Create: `server/src/models/UserMemberLink.js`、`server/src/models/InviteCode.js`
- Modify: `server/src/models/User.js`、`server/src/models/FamilyMember.js`、`server/src/models/index.js`
- Test: `server/tests/models.test.js`

**Interfaces:**
- Produces:
  - `User` 新字段 `role`(ENUM('admin','member'),默认 'member')、`displayName`(STRING(50) nullable)
  - `UserMemberLink`:`{ userId, memberId, role: ENUM('self','owner','editor','viewer'), relationship: STRING(20) default '家人' }`,唯一 `(userId, memberId)`
  - `InviteCode`:`{ code unique STRING(16), createdById, memberId nullable, maxUses INT default 1, usedCount INT default 0, expiresAt DATE nullable, active BOOLEAN default true }`
  - `buildModels(sequelize)`(models/index.js 导出,测试/迁移用它构建隔离实例)
  - `FamilyMember.userId` 改 `allowNull: true`(relationship 字段暂留,Task 13 删)
- Consumes: 无

- [ ] **Step 1: 写模型测试**

`server/tests/models.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { Sequelize } = require('sequelize');
const { buildModels } = require('../src/models');

async function freshDb() {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  const models = buildModels(sequelize);
  await sequelize.sync({ force: true });
  return { sequelize, models };
}

test('User.role 默认 member,可设 admin', async () => {
  const { models } = await freshDb();
  const u = await models.User.create({ username: 'u1', password: '123456' });
  assert.strictEqual(u.role, 'member');
  const a = await models.User.create({ username: 'u2', password: '123456', role: 'admin' });
  assert.strictEqual(a.role, 'admin');
});

test('UserMemberLink 唯一约束 (userId, memberId)', async () => {
  const { models, sequelize } = await freshDb();
  const u = await models.User.create({ username: 'u1', password: '123456' });
  const m = await models.FamilyMember.create({ name: 'A', gender: '男' });
  await models.UserMemberLink.create({ userId: u.id, memberId: m.id, role: 'owner', relationship: '父亲' });
  await assert.rejects(
    () => models.UserMemberLink.create({ userId: u.id, memberId: m.id, role: 'viewer' }),
    (e) => e.name === 'SequelizeUniqueConstraintError'
  );
});

test('InviteCode code 唯一且默认 maxUses=1/active=true', async () => {
  const { models } = await freshDb();
  const a = await models.User.create({ username: 'u1', password: '123456' });
  const i = await models.InviteCode.create({ code: 'ABCD2345', createdById: a.id });
  assert.strictEqual(i.maxUses, 1);
  assert.strictEqual(i.active, true);
  await assert.rejects(
    () => models.InviteCode.create({ code: 'ABCD2345', createdById: a.id }),
    (e) => e.name === 'SequelizeUniqueConstraintError'
  );
});
```

- [ ] **Step 2: 运行确认失败(模型不存在)**

```bash
cd server && npm test -- tests/models.test.js
```
Expected: FAIL(找不到 buildModels/UserMemberLink)。

- [ ] **Step 3: 实现模型**

`server/src/models/User.js` 在 define 字段中追加:
```js
role: {
  type: DataTypes.ENUM('admin', 'member'),
  allowNull: false,
  defaultValue: 'member'
},
displayName: {
  type: DataTypes.STRING(50),
  allowNull: true,
  validate: { len: [0, 50] }
},
```

`server/src/models/FamilyMember.js`:`userId` 字段 `allowNull: false` → `allowNull: true`(其余不动)。

`server/src/models/UserMemberLink.js`:
```js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserMemberLink = sequelize.define('UserMemberLink', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.INTEGER, allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    memberId: {
      type: DataTypes.INTEGER, allowNull: false,
      references: { model: 'family_members', key: 'id' }
    },
    role: {
      type: DataTypes.ENUM('self', 'owner', 'editor', 'viewer'),
      allowNull: false,
      defaultValue: 'owner'
    },
    relationship: {
      type: DataTypes.STRING(20), allowNull: false, defaultValue: '家人',
      comment: '当前账户视角下的关系称谓'
    },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'user_member_links',
    indexes: [
      { unique: true, fields: ['userId', 'memberId'] },
      { fields: ['memberId'] },
      { fields: ['role'] }
    ]
  });
  return UserMemberLink;
};
```

`server/src/models/InviteCode.js`:
```js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InviteCode = sequelize.define('InviteCode', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(16), allowNull: false, unique: true },
    createdById: {
      type: DataTypes.INTEGER, allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    memberId: {
      type: DataTypes.INTEGER, allowNull: true,
      references: { model: 'family_members', key: 'id' }
    },
    maxUses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1, max: 100 } },
    usedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    expiresAt: { type: DataTypes.DATE, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'invite_codes',
    indexes: [{ fields: ['code'] }, { fields: ['active'] }]
  });
  return InviteCode;
};
```

`server/src/models/index.js` 重构为工厂 + 单例:
```js
const { Sequelize } = require('sequelize');
const { db: dbConfig } = require('../config');

function buildModels(sequelize) {
  const User = require('./User')(sequelize);
  const FamilyMember = require('./FamilyMember')(sequelize);
  const UserMemberLink = require('./UserMemberLink')(sequelize);
  const InviteCode = require('./InviteCode')(sequelize);
  const MedicalIndicator = require('./MedicalIndicator')(sequelize);
  const MedicalReport = require('./MedicalReport')(sequelize);
  const ReportIndicatorData = require('./ReportIndicatorData')(sequelize);
  const Medication = require('./Medication')(sequelize);
  const MedicalLog = require('./MedicalLog')(sequelize);
  const SystemConfig = require('./SystemConfig')(sequelize);

  // 用户-成员多对多
  FamilyMember.belongsToMany(User, { through: UserMemberLink, foreignKey: 'memberId', otherKey: 'userId', as: 'linkedUsers' });
  User.belongsToMany(FamilyMember, { through: UserMemberLink, foreignKey: 'userId', otherKey: 'memberId', as: 'linkedMembers' });
  UserMemberLink.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  UserMemberLink.belongsTo(FamilyMember, { foreignKey: 'memberId', as: 'member' });

  // 邀请码
  InviteCode.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });
  InviteCode.belongsTo(FamilyMember, { foreignKey: 'memberId', as: 'member' });
  User.hasMany(InviteCode, { foreignKey: 'createdById', as: 'createdInvites' });

  // ……(原有全部关联原样保留:FamilyMember/User 旧关联此时共存到 Task 13 删除,
  //   Member.belongsTo(User...) 保留不碍事,开发库列还在)

  return { User, FamilyMember, UserMemberLink, InviteCode, MedicalIndicator,
           MedicalReport, ReportIndicatorData, Medication, MedicalLog, SystemConfig };
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbConfig.storage,
  logging: dbConfig.logging
});
const models = buildModels(sequelize);

module.exports = { sequelize, buildModels, ...models };
```
注意:原文件中 `FamilyMember.belongsTo(User...)` / `User.hasMany(FamilyMembers...)` 两行**保留**(Task 13 移除);其余关联(reports、medications、medicalLogs 等)原样复制进 buildModels。

- [ ] **Step 4: 运行全部测试通过(既有测试不受影响)**

```bash
cd server && npm test
```

- [ ] **Step 5: Commit**

```bash
git add -A server && git commit -m "feat(server): v2 models (UserMemberLink, InviteCode, user role) + buildModels factory"
```

### Task 6: accessService(权限矩阵,TDD)

**Files:**
- Create: `server/src/services/accessService.js`
- Test: `server/tests/access-service.test.js`

**Interfaces:**
- Produces:
  - `getMemberRole(userId, memberId)` → `'self'|'owner'|'editor'|'viewer'|'admin'|null`(admin 恒返回 'admin',即使无 link)
  - `assertAccess(userId, memberId, level)` → 返回 role;无权限抛 `HttpError(403)`,成员不存在或不可见抛 `HttpError(404)`。level ∈ `'view'|'edit'|'manage'|'grant'`
  - `getVisibleMemberIds(userId)` → `number[]`(有 link 的成员;admin 返回全部)
  - `listVisibleMembers(userId)` → `[{...member, role, relationship}]`(admin 对无 link 成员返回 role='admin', relationship=null)
  - `getSelfMember(userId)` → member 或 null
- Consumes: Task 5 模型

- [ ] **Step 1: 写失败测试(全矩阵)**

`server/tests/access-service.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { sequelize, User, FamilyMember, UserMemberLink } = require('../src/models');
const accessService = require('../src/services/accessService');

async function seed() {
  await sequelize.sync({ force: true });
  const admin = await User.create({ username: 'admin', password: 'x', role: 'admin' });
  const alice = await User.create({ username: 'alice', password: 'x' });
  const bob = await User.create({ username: 'bob', password: 'x' });
  const carol = await User.create({ username: 'carol', password: 'x' });
  const dad = await FamilyMember.create({ name: '爸', gender: '男' });
  // alice: self(爸是她本人);bob: owner(代管);carol: viewer;editor 用户:
  const dave = await User.create({ username: 'dave', password: 'x' });
  await UserMemberLink.bulkCreate([
    { userId: alice.id, memberId: dad.id, role: 'self', relationship: '本人' },
    { userId: bob.id, memberId: dad.id, role: 'owner', relationship: '父亲' },
    { userId: carol.id, memberId: dad.id, role: 'viewer', relationship: '家人' },
    { userId: dave.id, memberId: dad.id, role: 'editor', relationship: '家人' }
  ]);
  return { admin, alice, bob, carol, dave, dad };
}

async function allows(userId, memberId, level) {
  try { await accessService.assertAccess(userId, memberId, level); return true; }
  catch { return false; }
}

test('权限矩阵:4 角色 × view/edit/manage/grant', async () => {
  const { admin, alice, bob, carol, dave, dad } = await seed();
  // view: 全部允许
  for (const u of [admin, alice, bob, carol, dave]) {
    assert.ok(await allows(u.id, dad.id, 'view'), `${u.username} 应可 view`);
  }
  // edit: self/owner/editor/admin
  assert.ok(await allows(alice.id, dad.id, 'edit'));
  assert.ok(await allows(bob.id, dad.id, 'edit'));
  assert.ok(await allows(dave.id, dad.id, 'edit'));
  assert.ok(await allows(admin.id, dad.id, 'edit'));
  assert.ok(!(await allows(carol.id, dad.id, 'edit')), 'viewer 不可 edit');
  // manage(编辑成员资料): self/owner/admin
  assert.ok(await allows(alice.id, dad.id, 'manage'));
  assert.ok(await allows(bob.id, dad.id, 'manage'));
  assert.ok(await allows(admin.id, dad.id, 'manage'));
  assert.ok(!(await allows(dave.id, dad.id, 'manage')), 'editor 不可 manage');
  assert.ok(!(await allows(carol.id, dad.id, 'manage')), 'viewer 不可 manage');
  // grant(授权): self/owner/admin
  assert.ok(await allows(alice.id, dad.id, 'grant'));
  assert.ok(await allows(bob.id, dad.id, 'grant'));
  assert.ok(await allows(admin.id, dad.id, 'grant'));
  assert.ok(!(await allows(dave.id, dad.id, 'grant')), 'editor 不可 grant');
});

test('无 link 的普通用户 → 404(不泄露存在性)', async () => {
  const { alice, dad } = await seed();
  const stranger = await User.create({ username: 'stranger', password: 'x' });
  await assert.rejects(
    () => accessService.assertAccess(stranger.id, dad.id, 'view'),
    (e) => e.status === 404
  );
  assert.strictEqual(await accessService.getMemberRole(stranger.id, dad.id), null);
  assert.ok(alice); // 引用保持
});

test('getVisibleMemberIds / listVisibleMembers / getSelfMember', async () => {
  const { admin, alice, carol, dad } = await seed();
  const stranger = await User.create({ username: 's2', password: 'x' });
  const ids = await accessService.getVisibleMemberIds(carol.id);
  assert.deepStrictEqual(ids.sort(), [dad.id].sort());
  const all = await accessService.getVisibleMemberIds(admin.id);
  assert.ok(all.includes(dad.id));
  const list = await accessService.listVisibleMembers(carol.id);
  assert.strictEqual(list[0].role, 'viewer');
  assert.strictEqual(list[0].name, '爸');
  const self = await accessService.getSelfMember(alice.id);
  assert.strictEqual(self.id, dad.id);
  assert.strictEqual(await accessService.getSelfMember(stranger.id), null);
});

test('不存在/无效 memberId', async () => {
  const { alice } = await seed();
  await assert.rejects(
    () => accessService.assertAccess(alice.id, 99999, 'view'),
    (e) => e.status === 404
  );
});
```
注意:此测试直接使用**单例**模型连接 —— 但单例 storage 是 `:memory:`(helpers/app 设置了环境变量)。为保证 helpers/app 已被加载设置环境变量,文件顶部先 `require('./helpers/app')` 再 require models。在测试文件最顶部加:
```js
require('./helpers/app'); // 确保 NODE_ENV/MEDCARE_DB_PATH 环境变量就位
```
(随后再 require models)。

- [ ] **Step 2: 运行确认失败**

```bash
cd server && npm test -- tests/access-service.test.js
```
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现 accessService**

`server/src/services/accessService.js`:
```js
const { User, FamilyMember, UserMemberLink } = require('../models');
const HttpError = require('../utils/httpError');

// 权限矩阵(规格 2.3):level → 允许的 link 角色;admin 恒通过
const LEVELS = {
  view: ['self', 'owner', 'editor', 'viewer'],
  edit: ['self', 'owner', 'editor'],          // 报告上传/编辑/删除
  manage: ['self', 'owner'],                  // 成员资料编辑/删除基线(删除另查 self link)
  grant: ['self', 'owner']                    // 授权他人
};

async function getMemberRole(userId, memberId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'role'] });
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  const link = await UserMemberLink.findOne({
    where: { userId, memberId },
    attributes: ['role']
  });
  return link ? link.role : null;
}

async function assertAccess(userId, memberId, level = 'view') {
  const member = await FamilyMember.findByPk(memberId, { attributes: ['id'] });
  if (!member) throw new HttpError(404, '成员不存在');
  const role = await getMemberRole(userId, memberId);
  if (!role) throw new HttpError(404, '成员不存在'); // 无可见性 → 与不存在同响应
  if (role === 'admin' || (LEVELS[level] || []).includes(role)) return role;
  throw new HttpError(403, '没有执行此操作的权限');
}

async function getVisibleMemberIds(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'role'] });
  if (!user) return [];
  if (user.role === 'admin') {
    const all = await FamilyMember.findAll({ attributes: ['id'] });
    return all.map((m) => m.id);
  }
  const links = await UserMemberLink.findAll({ where: { userId }, attributes: ['memberId'] });
  return links.map((l) => l.memberId);
}

async function listVisibleMembers(userId) {
  const ids = await getVisibleMemberIds(userId);
  if (ids.length === 0) return [];
  const members = await FamilyMember.findAll({ where: { id: ids } });
  const links = await UserMemberLink.findAll({ where: { userId, memberId: ids } });
  const linkByMember = new Map(links.map((l) => [l.memberId, l]));
  return members.map((m) => {
    const link = linkByMember.get(m.id);
    const data = m.toJSON();
    data.role = link ? link.role : 'admin';
    data.relationship = link ? link.relationship : null;
    data.age = m.getAge();
    data.bmi = m.getBMI();
    return data;
  });
}

async function getSelfMember(userId) {
  const link = await UserMemberLink.findOne({ where: { userId, role: 'self' } });
  if (!link) return null;
  return FamilyMember.findByPk(link.memberId);
}

module.exports = { getMemberRole, assertAccess, getVisibleMemberIds, listVisibleMembers, getSelfMember, LEVELS };
```

- [ ] **Step 4: 运行通过 + 提交**

```bash
cd server && npm test
git add -A server && git commit -m "feat(server): accessService permission matrix with full TDD coverage"
```

### Task 7: migrate-v2 迁移脚本(TDD)

**Files:**
- Create: `server/scripts/migrate-v2.js`
- Test: `server/tests/migrate-v2.test.js`
- Modify: `server/package.json`(scripts 加 `"migrate-v2": "node scripts/migrate-v2.js"`)

**Interfaces:**
- Produces: `migrateV2(sequelize)`(脚本导出,幂等:检测 `user_member_links` 表存在即跳过);`finalizeV2(sequelize)`(占位导出,Task 13 实现删列);CLI 入口 `node scripts/migrate-v2.js [--finalize]`
- Consumes: Task 5 模型定义(用于新表 DDL 参考,但迁移直接用原始 SQL 操作 v1 库)

- [ ] **Step 1: 写失败测试**

`server/tests/migrate-v2.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { Sequelize } = require('sequelize');
const { migrateV2 } = require('../scripts/migrate-v2');

// 构造 v1 库:旧 family_members(userId/relationship NOT NULL)+ users
async function buildV1Db() {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  await sequelize.query(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL, createdAt DATETIME, updatedAt DATETIME);
    CREATE TABLE family_members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      gender TEXT NOT NULL, relationship TEXT NOT NULL, birthday DATEONLY,
      weight DECIMAL(5,2), height DECIMAL(5,2),
      userId INTEGER NOT NULL, createdAt DATETIME, updatedAt DATETIME);
    INSERT INTO users (username, password) VALUES ('oldadmin', 'hash');
    INSERT INTO family_members (name, gender, relationship, userId) VALUES
      ('老王', '男', '本人', 1),
      ('老王爸', '男', '父亲', 1),
      ('老王妈', '女', '母亲', 1);
  `);
  return sequelize;
}

test('迁移:建 links、admin 角色、可重复执行', async () => {
  const sequelize = await buildV1Db();
  await migrateV2(sequelize);

  const [links] = await sequelize.query('SELECT * FROM user_member_links');
  assert.strictEqual(links.length, 3);
  const selfLink = links.find((l) => l.role === 'self');
  assert.strictEqual(selfLink.userId, 1);
  const [users] = await sequelize.query('SELECT role FROM users');
  assert.strictEqual(users[0].role, 'admin');

  const [invites] = await sequelize.query('SELECT COUNT(*) as c FROM invite_codes');
  assert.ok(Number(invites[0].c) >= 0);

  // 幂等
  await migrateV2(sequelize);
  const [links2] = await sequelize.query('SELECT * FROM user_member_links');
  assert.strictEqual(links2.length, 3);

  // 旧列保留且已放宽为可空(新代码不再写它们)
  await sequelize.query(
    "INSERT INTO family_members (name, gender, relationship, userId) VALUES ('新成员', '女', '家人', 1)");
  const [relaxed] = await sequelize.query(
    "SELECT COUNT(*) as c FROM family_members WHERE relationship IS NULL OR userId IS NULL");
  assert.ok(Number(relaxed[0].c) >= 0);

  await sequelize.close();
});
```

- [ ] **Step 2: 运行确认失败**

```bash
cd server && npm test -- tests/migrate-v2.test.js
```
Expected: FAIL(找不到 migrate-v2)。

- [ ] **Step 3: 实现迁移脚本**

`server/scripts/migrate-v2.js`:
```js
/**
 * v1 → v2 数据迁移
 * - users 加 role/displayName,既有用户全部设为 admin(单管理员时代只有 1 个)
 * - 建 user_member_links / invite_codes
 * - family_members(userId, relationship) 数据迁入 links 后放宽为可空(列保留,Task 13 --finalize 删除)
 * 幂等;文件库会在运行前自动备份。
 */
const fs = require('fs');
const path = require('path');

async function tableExists(sequelize, name) {
  const [rows] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = $name",
    { bind: { name } });
  return rows.length > 0;
}

async function migrateV2(sequelize) {
  if (await tableExists(sequelize, 'user_member_links')) {
    console.log('[migrate-v2] user_member_links 已存在,跳过(幂等)');
    return { skipped: true };
  }
  await sequelize.query("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
  await sequelize.query('ALTER TABLE users ADD COLUMN displayName TEXT');
  await sequelize.query("UPDATE users SET role = 'admin'"); // v1 唯一用户 → admin

  await sequelize.query(`CREATE TABLE user_member_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id),
    memberId INTEGER NOT NULL REFERENCES family_members(id),
    role TEXT NOT NULL DEFAULT 'owner',
    relationship TEXT NOT NULL DEFAULT '家人',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(userId, memberId)
  )`);
  await sequelize.query('CREATE INDEX idx_uml_member ON user_member_links(memberId)');
  await sequelize.query('CREATE INDEX idx_uml_role ON user_member_links(role)');

  await sequelize.query(`CREATE TABLE invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    createdById INTEGER NOT NULL REFERENCES users(id),
    memberId INTEGER REFERENCES family_members(id),
    maxUses INTEGER NOT NULL DEFAULT 1,
    usedCount INTEGER NOT NULL DEFAULT 0,
    expiresAt DATETIME,
    active BOOLEAN NOT NULL DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // family_members → links(relationship='本人' → self,其余 owner)
  const [members] = await sequelize.query(
    'SELECT id, userId, relationship FROM family_members');
  for (const m of members) {
    const isSelf = m.relationship === '本人';
    // 每用户 self 唯一:若该用户已有 self,降级为 owner
    let role = isSelf ? 'self' : 'owner';
    if (isSelf) {
      const [existing] = await sequelize.query(
        'SELECT COUNT(*) as c FROM user_member_links WHERE userId = ? AND role = \'self\'',
        { replacements: [m.userId] });
      if (Number(existing[0].c) > 0) role = 'owner';
    }
    await sequelize.query(
      'INSERT INTO user_member_links (userId, memberId, role, relationship) VALUES (?, ?, ?, ?)',
      { replacements: [m.userId, m.id, role, m.relationship || '家人'] });
  }

  // 放宽 legacy 列(表重建:保留列、允许 NULL)
  await sequelize.query(`
    CREATE TABLE family_members_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      birthday DATEONLY,
      weight DECIMAL(5,2),
      height DECIMAL(5,2),
      userId INTEGER,
      relationship TEXT,
      createdAt DATETIME,
      updatedAt DATETIME
    )`);
  await sequelize.query(`
    INSERT INTO family_members_new (id, name, gender, birthday, weight, height, userId, relationship, createdAt, updatedAt)
    SELECT id, name, gender, birthday, weight, height, userId, relationship, createdAt, updatedAt FROM family_members`);
  await sequelize.query('DROP TABLE family_members');
  await sequelize.query('ALTER TABLE family_members_new RENAME TO family_members');

  console.log(`[migrate-v2] 完成:迁移 ${members.length} 个成员的 links`);
  return { skipped: false, members: members.length };
}

// Task 13 实现删除 userId/relationship 列;此版本为占位
async function finalizeV2(sequelize) {
  if (await tableExists(sequelize, 'family_members_new')) return { skipped: true };
  await sequelize.query(`
    CREATE TABLE family_members_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      birthday DATEONLY,
      weight DECIMAL(5,2),
      height DECIMAL(5,2),
      createdAt DATETIME,
      updatedAt DATETIME
    )`);
  await sequelize.query(`
    INSERT INTO family_members_new (id, name, gender, birthday, weight, height, createdAt, updatedAt)
    SELECT id, name, gender, birthday, weight, height, createdAt, updatedAt FROM family_members`);
  await sequelize.query('DROP TABLE family_members');
  await sequelize.query('ALTER TABLE family_members_new RENAME TO family_members');
  console.log('[migrate-v2] finalize 完成:已删除 legacy 列');
  return { skipped: false };
}

async function main() {
  require('dotenv').config();
  const { sequelize } = require('../src/models');
  const storage = sequelize.options.storage;
  if (storage && storage !== ':memory:' && fs.existsSync(storage)) {
    const backup = `${storage}.v1-backup-${Date.now()}`;
    fs.copyFileSync(storage, backup);
    console.log(`[migrate-v2] 已备份至 ${backup}`);
  }
  const finalize = process.argv.includes('--finalize');
  if (finalize) await finalizeV2(sequelize);
  else await migrateV2(sequelize);
  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { migrateV2, finalizeV2 };
```
`server/package.json` scripts 增加 `"migrate-v2": "node scripts/migrate-v2.js"`。

注:finalizeV2 幂等判断——若 family_members 已无 userId 列(检测:`PRAGMA table_info(family_members)` 不含 userId),直接跳过。实现时把上面的 `tableExists(family_members_new)` 判断改为 PRAGMA 检查:
```js
const [cols] = await sequelize.query('PRAGMA table_info(family_members)');
if (!cols.some((c) => c.name === 'userId')) return { skipped: true };
```

- [ ] **Step 4: 测试通过 + 在开发库运行**

```bash
cd server && npm test
npm run migrate-v2   # 开发库(若存在 database/medcare.db)
```
Expected: 控制台输出备份路径与迁移数量;再次运行输出"跳过(幂等)"。

- [ ] **Step 5: Commit**

```bash
git add -A server && git commit -m "feat(server): idempotent migrate-v2 script with backup and tests"
```

### Task 8: inviteService + preview-invite 端点(TDD)

**Files:**
- Create: `server/src/services/inviteService.js`
- Modify: `server/src/controllers/authController.js`(+previewInvite)、`server/src/routes/auth.js`
- Test: `server/tests/invite-service.test.js`

**Interfaces:**
- Produces:
  - `inviteService.createInvite({ createdById, memberId?, maxUses=1, expiresAt? })` → invite
  - `inviteService.validateInvite(code)` → invite(无效/过期/停用/耗尽抛 `HttpError(400, 具体原因)`)
  - `inviteService.consumeInvite(code, transaction)` → invite(原子条件更新,失败抛 400)
  - `inviteService.listInvites()`、`inviteService.deactivate(id)`
  - `POST /api/auth/preview-invite` `{ inviteCode }` → `{ data: { boundMember } }` 或 `{ data: { claimableMembers: [...] } }`(claimable = 无 self link 的成员)
- Consumes: Task 5 模型、Task 1 HttpError

- [ ] **Step 1: 写失败测试**

`server/tests/invite-service.test.js`:
```js
require('./helpers/app');
const test = require('node:test');
const assert = require('node:assert');
const { sequelize, User, FamilyMember, UserMemberLink } = require('../src/models');
const inviteService = require('../src/services/inviteService');
const HttpError = require('../src/utils/httpError');

async function seed() {
  await sequelize.sync({ force: true });
  const admin = await User.create({ username: 'admin', password: 'x', role: 'admin' });
  const m = await FamilyMember.create({ name: '爸', gender: '男' });
  await UserMemberLink.create({ userId: admin.id, memberId: m.id, role: 'owner', relationship: '父亲' });
  return { admin, m };
}

test('生成与校验', async () => {
  const { admin } = await seed();
  const inv = await inviteService.createInvite({ createdById: admin.id });
  assert.match(inv.code, /^[A-Z2-9]{8}$/);
  const got = await inviteService.validateInvite(inv.code);
  assert.strictEqual(got.id, inv.id);
});

test('过期/停用/耗尽均拒绝', async () => {
  const { admin } = await seed();
  const expired = await inviteService.createInvite({
    createdById: admin.id, expiresAt: new Date(Date.now() - 86400000) });
  await assert.rejects(() => inviteService.validateInvite(expired.code),
    (e) => e instanceof HttpError && e.status === 400);

  const off = await inviteService.createInvite({ createdById: admin.id });
  await inviteService.deactivate(off.id);
  await assert.rejects(() => inviteService.validateInvite(off.code), (e) => e.status === 400);

  const one = await inviteService.createInvite({ createdById: admin.id });
  await inviteService.consumeInvite(one.code);
  await assert.rejects(() => inviteService.validateInvite(one.code), (e) => e.status === 400);
});

test('maxUses=2:第三次消费被拒(防超发)', async () => {
  const { admin } = await seed();
  const inv = await inviteService.createInvite({ createdById: admin.id, maxUses: 2 });
  await inviteService.consumeInvite(inv.code);
  await inviteService.consumeInvite(inv.code);
  await assert.rejects(() => inviteService.consumeInvite(inv.code), (e) => e.status === 400);
});

test('专属码绑定成员', async () => {
  const { admin, m } = await seed();
  const inv = await inviteService.createInvite({ createdById: admin.id, memberId: m.id });
  assert.strictEqual(inv.memberId, m.id);
});
```

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 inviteService**

`server/src/services/inviteService.js`:
```js
const crypto = require('crypto');
const { InviteCode, FamilyMember, UserMemberLink, sequelize } = require('../models');
const HttpError = require('../utils/httpError');

// 无易混淆字符(去 0O1IL)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function createInvite({ createdById, memberId = null, maxUses = 1, expiresAt = null }) {
  if (memberId) {
    const member = await FamilyMember.findByPk(memberId);
    if (!member) throw new HttpError(400, '指定成员不存在');
    const claimed = await UserMemberLink.findOne({ where: { memberId, role: 'self' } });
    if (claimed) throw new HttpError(400, '该成员已被本人账户绑定,不能生成专属邀请码');
  }
  for (let i = 0; i < 5; i++) {
    try {
      return await InviteCode.create({ code: generateCode(), createdById, memberId, maxUses, expiresAt, active: true });
    } catch (e) {
      if (e.name !== 'SequelizeUniqueConstraintError') throw e;
    }
  }
  throw new HttpError(500, '生成邀请码失败，请重试');
}

async function validateInvite(code) {
  if (!code || typeof code !== 'string') throw new HttpError(400, '邀请码不能为空');
  const invite = await InviteCode.findOne({ where: { code: code.trim().toUpperCase() } });
  if (!invite) throw new HttpError(400, '邀请码无效');
  if (!invite.active) throw new HttpError(400, '邀请码已停用');
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) throw new HttpError(400, '邀请码已过期');
  if (invite.usedCount >= invite.maxUses) throw new HttpError(400, '邀请码使用次数已用完');
  return invite;
}

// 原子消费:条件更新防并发超发
async function consumeInvite(code, transaction) {
  const invite = await validateInvite(code);
  const [affected] = await InviteCode.update(
    { usedCount: invite.usedCount + 1 },
    {
      where: { id: invite.id, usedCount: invite.usedCount, active: true },
      transaction
    }
  );
  if (affected === 0) throw new HttpError(400, '邀请码使用次数已用完');
  return invite;
}

async function listInvites() {
  return InviteCode.findAll({
    include: [
      { association: 'createdBy', attributes: ['id', 'username'] },
      { association: 'member', attributes: ['id', 'name'] }
    ],
    order: [['createdAt', 'DESC']]
  });
}

async function deactivate(id) {
  const invite = await InviteCode.findByPk(id);
  if (!invite) throw new HttpError(404, '邀请码不存在');
  invite.active = false;
  await invite.save();
  return invite;
}

module.exports = { createInvite, validateInvite, consumeInvite, listInvites, deactivate };
```

`authController` 增加(路由 `POST /api/auth/preview-invite`,公开 + authLimiter):
```js
exports.previewInvite = asyncHandler(async (req, res) => {
  const invite = await inviteService.validateInvite(req.body.inviteCode);
  if (invite.memberId) {
    const member = await FamilyMember.findByPk(invite.memberId, { attributes: ['id', 'name', 'gender', 'birthday'] });
    return res.json({ success: true, data: { boundMember: member } });
  }
  // 通用码:返回可认领成员(无 self link)
  const claimedMemberIds = (await UserMemberLink.findAll({ where: { role: 'self' }, attributes: ['memberId'] }))
    .map((l) => l.memberId);
  const claimable = await FamilyMember.findAll({
    where: claimedMemberIds.length ? { id: { [Sequelize.Op.notIn]: claimedMemberIds } } : {},
    attributes: ['id', 'name', 'gender', 'birthday'],
    order: [['createdAt', 'DESC']]
  });
  res.json({ success: true, data: { claimableMembers: claimable } });
});
```

- [ ] **Step 4: 测试通过 + 提交**

```bash
cd server && npm test
git add -A server && git commit -m "feat(server): inviteService with atomic consume + preview-invite endpoint"
```

### Task 9: 注册 v2(邀请码/认领/首账户 admin)+ /api/auth/me + JWT 30d

**Files:**
- Modify: `server/src/services/authService.js`(或 authController 中注册逻辑所在文件)、`server/src/controllers/authController.js`、`server/src/routes/auth.js`
- Modify: `server/src/config/index.js`(expiresIn 默认 '30d')、`server/.env.example`
- Modify: `server/tests/helpers/app.js`(createAdmin 改新协议)
- Test: `server/tests/register-v2.test.js`

**Interfaces:**
- Produces:
  - `POST /api/auth/register` 新 body:`{ username, password, inviteCode?, mode: 'create'|'claim', memberData?: {name, gender, birthday?}, claimMemberId? }`;首账户(User.count()===0)免邀请码并 role=admin;响应 `{ data: { user: {id, username, displayName, role}, token } }`
  - `POST /api/members/bind-self`(登录态,同 mode 规则,用于老账户补绑)——路由挂在 members(Task 10 的路由文件提前在此创建该端点亦可;实现放 authService)
  - `GET /api/auth/me` → `{ data: { user: {id, username, displayName, role}, selfMember: {...}|null } }`
  - JWT 默认过期 `30d`
- Consumes: Task 8 inviteService、Task 6 accessService

- [ ] **Step 1: 更新 helper + 写失败测试**

`server/tests/helpers/app.js` 的 createAdmin 改为:
```js
async function createAdmin(username = 'admin') {
  const app = await getTestApp();
  const res = await request(app).post('/api/auth/register').send({
    username, password: 'pass123456', mode: 'create',
    memberData: { name: `${username}本人`, gender: '男' }
  });
  if (res.status !== 201) throw new Error(`createAdmin 失败: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.data.token, userId: res.body.data.user.id };
}
// 新增:注册普通成员账户(需邀请码)
async function createUser(username, { inviteCode, mode = 'create', memberData = null, claimMemberId = null } = {}) {
  const app = await getTestApp();
  const res = await request(app).post('/api/auth/register').send({
    username, password: 'pass123456', inviteCode, mode, memberData, claimMemberId
  });
  return res;
}
module.exports = { getTestApp, createAdmin, createUser, auth, request };
```
注意:既有 members/reports 测试现在依赖 createAdmin 新协议——运行全量测试确认仍绿。

`server/tests/register-v2.test.js`(首个账户逻辑在其他文件已由 createAdmin 覆盖——admin.role==='admin' 在此断言一次):
```js
const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');
const { User } = require('../src/models');

async function setup() {
  const app = await getTestApp();
  const admin = await createAdmin('regadmin');
  return { app, admin };
}

test('本文件库中首个账户(createAdmin)为 admin 角色', async () => {
  await setup();
  const first = await User.findOne({ where: { username: 'regadmin' } });
  assert.strictEqual(first.role, 'admin');
});

test('已有账户后,无邀请码注册被拒', async () => {
  const { app } = await setup();
  const res = await request(app).post('/api/auth/register').send({
    username: 'noob', password: 'pass123456', mode: 'create',
    memberData: { name: '无码', gender: '女' } });
  assert.strictEqual(res.status, 400);
});

test('通用码 + mode=create:新成员 + self link + me 返回', async () => {
  const { app, admin } = await setup();
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const res = await createUser('u1', { inviteCode: inv.code, memberData: { name: '新一', gender: '女' } });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.user.role, 'member');
  const me = await auth(request(app).get('/api/auth/me'), res.body.data.token);
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.body.data.selfMember.name, '新一');
  // 邀请码已消耗
  const res2 = await createUser('u1b', { inviteCode: inv.code, memberData: { name: '重复用', gender: '女' } });
  assert.strictEqual(res2.status, 400);
});

test('专属码 + mode=claim:认领指定成员;认领他人已绑定成员被拒', async () => {
  const { app, admin, } = await setup();
  // admin 先建一个待认领成员
  const m = await auth(request(app).post('/api/family-members'), admin.token)
    .send({ name: '待认领爸', gender: '男', relationship: '父亲' });
  const inv = await inviteService.createInvite({ createdById: admin.userId, memberId: m.body.data.id });
  const res = await createUser('dad', { inviteCode: inv.code, mode: 'claim', claimMemberId: m.body.data.id });
  assert.strictEqual(res.status, 201);
  const me = await auth(request(app).get('/api/auth/me'), res.body.data.token);
  assert.strictEqual(me.body.data.selfMember.id, m.body.data.id);

  // 第二人再认领同一成员 → 409
  const inv2 = await inviteService.createInvite({ createdById: admin.userId });
  const res2 = await createUser('impostor', {
    inviteCode: inv2.code, mode: 'claim', claimMemberId: m.body.data.id });
  assert.strictEqual(res2.status, 409);

  // 专属码认领别的成员 → 400
  const other = await auth(request(app).post('/api/family-members'), admin.token)
    .send({ name: '别人', gender: '女', relationship: '母亲' });
  const inv3 = await inviteService.createInvite({ createdById: admin.userId, memberId: other.body.data.id });
  const res3 = await createUser('u3', {
    inviteCode: inv3.code, mode: 'claim', claimMemberId: m.body.data.id });
  assert.strictEqual(res3.status, 400);
});

test('bind-self:老账户补绑', async () => {
  const { app, admin } = await setup();
  // 构造无 self 的老账户:admin 账户在 helper 中已有 self;直接用邀请码注册新用户后删其 self link 模拟
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser('legacy', { inviteCode: inv.code, memberData: { name: 'legacy本人', gender: '男' } });
  const token = reg.body.data.token;
  const { UserMemberLink } = require('../src/models');
  const uid = reg.body.data.user.id;
  await UserMemberLink.destroy({ where: { userId: uid, role: 'self' } });
  // 再补绑(claim 一个新成员)
  const m = await auth(request(app).post('/api/family-members'), admin.token)
    .send({ name: '补绑对象', gender: '男', relationship: '家人' });
  const res = await auth(request(app).post('/api/members/bind-self'), token)
    .send({ mode: 'claim', claimMemberId: m.body.data.id });
  assert.strictEqual(res.status, 200);
});
```

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现注册改造**

`authController.register` 重写(路由处保留 `authLimiter` 前置;username/password 的消毒与校验沿用现有实现):
```js
exports.register = asyncHandler(async (req, res) => {
  let { username, password, inviteCode, mode, memberData = {}, claimMemberId } = req.body;
  // ……现有 username/password 校验原样(格式/长度/消毒),不合规直接 400……

  const { user, token, isFirst } = await sequelize.transaction(async (t) => {
    const userCount = await User.count({ transaction: t });
    let role = 'member';
    if (userCount === 0) {
      role = 'admin'; // 首个账户免邀请码
    } else if (!inviteCode) {
      throw new HttpError(400, '需要邀请码');
    }
    if (inviteCode) await inviteService.validateInvite(inviteCode); // 先校验,消费放最后

    const created = await User.create({ username, password, role }, { transaction: t });
    await authService.bindSelfForUser(created.id, { mode, memberData, claimMemberId, inviteCode, transaction: t });
    if (inviteCode) await inviteService.consumeInvite(inviteCode, t);

    const signed = jwt.sign({ id: created.id, username: created.username }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
    return { user: created, token: signed, isFirst: userCount === 0 };
  });

  res.status(201).json({
    success: true,
    message: isFirst ? '管理员账户创建成功' : '注册成功',
    data: {
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
      token
    }
  });
});
```

`authService.bindSelfForUser(userId, { mode, memberData, claimMemberId, inviteCode, transaction })`(bind-self 端点复用):
```js
async function bindSelfForUser(userId, { mode = 'create', memberData = {}, claimMemberId = null, inviteCode = null, transaction }) {
  // 已有 self 则拒绝
  const existing = await UserMemberLink.findOne({ where: { userId, role: 'self' }, transaction });
  if (existing) throw new HttpError(400, '该账户已绑定本人信息');

  let memberId;
  if (mode === 'claim') {
    if (!claimMemberId) throw new HttpError(400, '缺少要认领的成员ID');
    const member = await FamilyMember.findByPk(claimMemberId, { transaction });
    if (!member) throw new HttpError(404, '要认领的成员不存在');
    const claimed = await UserMemberLink.findOne({ where: { memberId: claimMemberId, role: 'self' }, transaction });
    if (claimed) throw new HttpError(409, '该成员已被其他账户绑定');
    if (inviteCode) {
      const invite = await inviteService.validateInvite(inviteCode);
      if (invite.memberId && invite.memberId !== claimMemberId) {
        throw new HttpError(400, '该邀请码只能绑定指定成员');
      }
    }
    memberId = claimMemberId;
  } else {
    const { name, gender, birthday } = memberData;
    const cleanName = escapeHtml(sanitizeInput(name, { maxLength: 50 }));
    if (!cleanName || !['男', '女', '其他'].includes(gender)) {
      throw new HttpError(400, '本人姓名和性别为必填字段');
    }
    if (birthday && !validateDate(birthday)) throw new HttpError(400, '无效的生日日期');
    const member = await FamilyMember.create(
      { name: cleanName, gender, birthday: birthday || null }, { transaction });
    memberId = member.id;
  }

  await UserMemberLink.create(
    { userId, memberId, role: 'self', relationship: '本人' }, { transaction });
  return memberId;
}
```

新增路由:
- `POST /api/auth/preview-invite`(Task 8 已加)
- `GET /api/auth/me`(authenticateToken):返回 user + `accessService.getSelfMember(req.user.id)`
- `POST /api/members/bind-self`(authenticateToken):`bindSelfForUser` 包事务(无邀请码分支)

`server/src/config/index.js`:`expiresIn: process.env.JWT_EXPIRES_IN || '30d'`;`.env.example` 同步注释说明。

- [ ] **Step 4: 全量测试通过(重点:既有 members/reports/smoke 测试在新 helper 协议下仍绿)+ 提交**

```bash
cd server && npm test
git add -A server && git commit -m "feat(server): invite-code registration with claim mode, /auth/me, bind-self, 30d JWT"
```

### Task 10: members API v2(可见列表/owner link 创建/权限矩阵接入/双路径挂载)

**Files:**
- Modify: `server/src/services/memberService.js`、`server/src/controllers/membersController.js`、`server/src/routes/members.js`、`server/src/app.js`
- Test: `server/tests/members-v2.test.js`

**Interfaces:**
- Produces:
  - `GET /api/members` → `accessService.listVisibleMembers` 结果(每项含 role/relationship/age/bmi/reportCount)
  - `POST /api/members` body `{name, gender, relationship?, birthday?, weight?, height?}` → 建全局成员 + 我的 `owner` link(relationship 存 link 上)
  - `GET/PUT/DELETE /api/members/:id` → 权限按矩阵(assertAccess view/manage/删除=owner+admin)
  - `PUT /api/members/:id` 若带 `relationship` 且我的 role ∈ {self, owner} → 更新**我的 link** 的 relationship
  - `DELETE /api/members/:id`:成员有 self link → 400 '该成员已绑定账户,请先解绑';有报告 → 400(保留现有规则);删除成员级联删 links
  - app.js 双挂载:`/api/members` 与 `/api/family-members`(别名至 Task 22)
- Consumes: Task 6 accessService

- [ ] **Step 1: 写失败测试**

`server/tests/members-v2.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');

async function setup() {
  const app = await getTestApp();
  const admin = await createAdmin('memadmin');
  return { app, admin };
}

async function makeUser(app, admin, username, memberName = `${username}本人`) {
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser(username, { inviteCode: inv.code, memberData: { name: memberName, gender: '男' } });
  return { token: reg.body.data.token, userId: reg.body.data.user.id };
}

test('列表只含可见成员且带视角 role', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'vis1');
  // admin 建家庭成员
  await auth(request(app).post('/api/members'), admin.token)
    .send({ name: '管理员家娃', gender: '女', relationship: '女儿' });
  // 新用户只见本人
  const list = await auth(request(app).get('/api/members'), u.token);
  assert.strictEqual(list.status, 200);
  const names = list.body.data.map((m) => m.name);
  assert.ok(names.includes('vis1本人'));
  assert.ok(!names.includes('管理员家娃'));
  const mine = list.body.data.find((m) => m.name === 'vis1本人');
  assert.strictEqual(mine.role, 'self');
  assert.strictEqual(mine.relationship, '本人');
  // admin 见全部
  const adminList = await auth(request(app).get('/api/members'), admin.token);
  assert.ok(adminList.body.data.length >= 2);
});

test('创建成员建立 owner link;旧路径别名可用', async () => {
  const { app, admin } = await setup();
  const res = await auth(request(app).post('/api/members'), admin.token)
    .send({ name: '新成员', gender: '男', relationship: '父亲' });
  assert.strictEqual(res.status, 201);
  const alias = await auth(request(app).get('/api/family-members'), admin.token);
  assert.strictEqual(alias.status, 200);
  assert.ok(alias.body.data.some((m) => m.name === '新成员'));
});

test('viewer 不能编辑成员资料;owner 可以', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'own1');
  const created = await auth(request(app).post('/api/members'), u.token)
    .send({ name: '我家老人', gender: '男', relationship: '父亲' });
  const mid = created.body.data.id;
  // owner 编辑 OK
  const ok = await auth(request(app).put(`/api/members/${mid}`), u.token).send({ weight: 65 });
  assert.strictEqual(ok.status, 200);
  // admin 授权给另一个 viewer
  const v = await makeUser(app, admin, 'view1');
  const grant = await auth(request(app).post(`/api/members/${mid}/links`), u.token)
    .send({ granteeUserId: v.userId, role: 'viewer' });
  assert.strictEqual(grant.status, 201);
  const denied = await auth(request(app).put(`/api/members/${mid}`), v.token).send({ weight: 70 });
  assert.strictEqual(denied.status, 403);
});

test('删除:有 self link 拒绝;无报告可删', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'del1');
  const meList = await auth(request(app).get('/api/members'), u.token);
  const selfId = meList.body.data.find((m) => m.role === 'self').id;
  const delSelf = await auth(request(app).delete(`/api/members/${selfId}`), u.token);
  assert.strictEqual(delSelf.status, 400);
  const created = await auth(request(app).post('/api/members'), u.token)
    .send({ name: '可删除', gender: '女', relationship: '女儿' });
  const del = await auth(request(app).delete(`/api/members/${created.body.data.id}`), u.token);
  assert.strictEqual(del.status, 200);
});
```
注:Task 11 才实现 `POST /:id/links`——本 Task 先实现删除/编辑/列表用例并让 links 用例失败,或把该用例移入 Task 11;执行时以 Task 11 一并补齐为准,此处先写全便于回归。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 memberService v2**

`memberService.js` 重写核心方法(消毒/校验逻辑沿用现有实现):
```js
const { FamilyMember, UserMemberLink, MedicalReport, sequelize } = require('../models');
const accessService = require('./accessService');
const HttpError = require('../utils/httpError');
const { sanitizeInput, escapeHtml, validateDate } = require('../utils/security');

async function listByUser(userId) {
  const members = await accessService.listVisibleMembers(userId);
  // 附带 reportCount(与 v1 响应字段兼容)
  const counts = await MedicalReport.findAll({
    attributes: ['memberId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['memberId']
  });
  const countMap = new Map(counts.map((c) => [c.memberId, Number(c.get('count'))]));
  return members.map((m) => ({ ...m, reportCount: countMap.get(m.id) || 0 }));
}

async function getById(userId, id) {
  await accessService.assertAccess(userId, id, 'view');
  const member = await FamilyMember.findByPk(id); // include reports 同 v1
  if (!member) throw new HttpError(404, '成员不存在');
  const data = member.toJSON();
  data.age = member.getAge();
  data.bmi = member.getBMI();
  return data;
}

async function create(userId, body) {
  const { name, gender, relationship, birthday, weight, height } = body;
  const cleanName = escapeHtml(sanitizeInput(name, { maxLength: 50 }));
  const cleanRel = escapeHtml(sanitizeInput(relationship || '家人', { maxLength: 20 }));
  if (!cleanName) throw new HttpError(400, '姓名为必填字段');
  if (!['男', '女', '其他'].includes(gender)) throw new HttpError(400, '无效的性别值');
  if (birthday && !validateDate(birthday)) throw new HttpError(400, '无效的生日日期');
  // weight/height 校验沿用 v1 实现(0< w ≤500, 0< h ≤300)

  return sequelize.transaction(async (t) => {
    const member = await FamilyMember.create(
      { name: cleanName, gender, birthday: birthday || null,
        weight: weight !== undefined ? parseFloat(weight) : null,
        height: height !== undefined ? parseFloat(height) : null },
      { transaction: t });
    await UserMemberLink.create(
      { userId, memberId: member.id, role: 'owner', relationship: cleanRel },
      { transaction: t });
    const data = member.toJSON();
    data.age = member.getAge(); data.bmi = member.getBMI();
    data.role = 'owner'; data.relationship = cleanRel;
    return data;
  });
}

async function update(userId, id, body) {
  const role = await accessService.assertAccess(userId, id, 'manage');
  const member = await FamilyMember.findByPk(id);
  if (!member) throw new HttpError(404, '成员不存在');
  const { name, gender, relationship, birthday, weight, height } = body;
  const cleanName = name !== undefined ? escapeHtml(sanitizeInput(name, { maxLength: 50 })) : member.name;
  if (gender && !['男', '女', '其他'].includes(gender)) throw new HttpError(400, '无效的性别值');
  if (birthday !== undefined && birthday !== null && !validateDate(birthday)) throw new HttpError(400, '无效的生日日期');
  const w = weight !== undefined ? parseFloat(weight) : member.weight;
  const h = height !== undefined ? parseFloat(height) : member.height;
  if (w !== null && (isNaN(w) || w <= 0 || w > 500)) throw new HttpError(400, '无效的体重值');
  if (h !== null && (isNaN(h) || h <= 0 || h > 300)) throw new HttpError(400, '无效的身高值');

  await member.update({
    name: cleanName || member.name,
    gender: gender || member.gender,
    birthday: birthday !== undefined ? birthday : member.birthday,
    weight: w, height: h
  });
  // 视角关系:仅 self/owner 可改自己的 link.relationship
  if (relationship && (role === 'self' || role === 'owner')) {
    await UserMemberLink.update(
      { relationship: escapeHtml(sanitizeInput(relationship, { maxLength: 20 })) },
      { where: { userId, memberId: id } });
  }
  const data = member.toJSON();
  data.age = member.getAge(); data.bmi = member.getBMI();
  return data;
}

async function remove(userId, id) {
  const role = await accessService.getMemberRole(userId, id);
  if (!role) throw new HttpError(404, '成员不存在');
  if (role !== 'owner' && role !== 'admin') throw new HttpError(403, '只有代管人或管理员可以删除成员');
  const selfLink = await UserMemberLink.findOne({ where: { memberId: id, role: 'self' } });
  if (selfLink) throw new HttpError(400, '该成员已绑定账户，请先解绑');
  const reportCount = await MedicalReport.count({ where: { memberId: id } });
  if (reportCount > 0) throw new HttpError(400, `无法删除该成员，存在 ${reportCount} 份关联报告`);
  await sequelize.transaction(async (t) => {
    await UserMemberLink.destroy({ where: { memberId: id }, transaction: t });
    await FamilyMember.destroy({ where: { id }, transaction: t });
  });
}
```
`app.js`:`app.use('/api/family-members', memberRoutes); app.use('/api/members', memberRoutes);`

- [ ] **Step 4: 测试通过 + 提交**

```bash
cd server && npm test
git add -A server && git commit -m "feat(server): members API on global-member model with access matrix + path alias"
```

### Task 11: links(授权)+ merge(合并)API

**Files:**
- Modify: `server/src/services/memberService.js`(+grantLink/listLinks/revokeLink/merge)、`server/src/controllers/membersController.js`、`server/src/routes/members.js`
- Test: `server/tests/links-merge.test.js`

**Interfaces:**
- Produces:
  - `GET /api/members/:id/links` → `[{id, userId, username, displayName, role, relationship, createdAt}]`(self/owner/admin)
  - `POST /api/members/:id/links` `{granteeUserId, role: 'viewer'|'editor'|'owner'|'self', relationship?}`:普通用户仅可授 viewer/editor;admin 另可授 owner,以及 self(仅当成员无 self link,用于换绑纠错);已有 link → 409
  - `DELETE /api/members/:id/links/:linkId`:self/owner/admin;`role='self'` 的 link 仅 admin 可删
  - `POST /api/members/merge` `{sourceId, targetId}`(admin):迁移 reports/medications/medicalLogs/links(role 冲突取 self>owner>editor>viewer 高者;self 冲突保 target 现有)→ 删 source

- [ ] **Step 1: 写失败测试**

`server/tests/links-merge.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');

async function setup() {
  const app = await getTestApp();
  const admin = await createAdmin('linkadmin');
  return { app, admin };
}
async function makeUser(app, admin, username) {
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser(username, { inviteCode: inv.code, memberData: { name: `${username}本人`, gender: '男' } });
  return { token: reg.body.data.token, userId: reg.body.data.user.id };
}

test('授权 viewer/editor、列表、撤销', async () => {
  const { app, admin } = await setup();
  const owner = await makeUser(app, admin, 'grantOwner');
  const created = await auth(request(app).post('/api/members'), owner.token)
    .send({ name: '授权对象', gender: '男', relationship: '父亲' });
  const mid = created.body.data.id;

  const v = await makeUser(app, admin, 'granteeV');
  const grant = await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: v.userId, role: 'viewer', relationship: '亲戚' });
  assert.strictEqual(grant.status, 201);

  // 重复授权 → 409
  const dup = await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: v.userId, role: 'editor' });
  assert.strictEqual(dup.status, 409);

  // 普通用户不能授 owner/self
  const bad = await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: v.userId, role: 'owner' });
  assert.strictEqual(bad.status, 403);

  const links = await auth(request(app).get(`/api/members/${mid}/links`), owner.token);
  assert.strictEqual(links.status, 200);
  const viewerLink = links.body.data.find((l) => l.userId === v.userId);
  assert.strictEqual(viewerLink.role, 'viewer');

  const revoke = await auth(request(app).delete(`/api/members/${mid}/links/${viewerLink.id}`), owner.token);
  assert.strictEqual(revoke.status, 200);
  const after = await auth(request(app).get('/api/members'), v.token);
  assert.ok(!after.body.data.some((m) => m.id === mid), '撤销后不可见');
});

test('非 self link 不可删除;admin 可删 self link(解绑)', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'selfDel');
  const meList = await auth(request(app).get('/api/members'), u.token);
  const selfId = meList.body.data.find((m) => m.role === 'self').id;
  const links = await auth(request(app).get(`/api/members/${selfId}/links`), u.token);
  const selfLink = links.body.data.find((l) => l.role === 'self');
  const denied = await auth(request(app).delete(`/api/members/${selfId}/links/${selfLink.id}`), u.token);
  assert.strictEqual(denied.status, 403);
  const ok = await auth(request(app).delete(`/api/members/${selfId}/links/${selfLink.id}`), admin.token);
  assert.strictEqual(ok.status, 200);
});

test('merge:报告与 links 迁移到目标成员', async () => {
  const { app, admin } = await setup();
  const u = await makeUser(app, admin, 'mergeU');
  const src = await auth(request(app).post('/api/members'), u.token)
    .send({ name: '重复爸', gender: '男', relationship: '父亲' });
  const tgt = await auth(request(app).post('/api/members'), u.token)
    .send({ name: '真爸', gender: '男', relationship: '父亲' });
  const report = await auth(request(app).post('/api/reports'), u.token)
    .field('familyMemberId', String(src.body.data.id))
    .field('reportDate', '2026-10-02');
  assert.strictEqual(report.status, 201);

  const merged = await auth(request(app).post('/api/members/merge'), admin.token)
    .send({ sourceId: src.body.data.id, targetId: tgt.body.data.id });
  assert.strictEqual(merged.status, 200);

  const tgtDetail = await auth(request(app).get(`/api/members/${tgt.body.data.id}`), u.token);
  assert.ok(tgtDetail.body.data.reports.some((r) => r.id === report.body.data.id));
  const srcGone = await auth(request(app).get(`/api/members/${src.body.data.id}`), u.token);
  assert.strictEqual(srcGone.status, 404);
});
```

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 links/merge 服务与路由**

`memberService` 追加:
```js
const ROLE_RANK = { self: 4, owner: 3, editor: 2, viewer: 1 };

async function listLinks(userId, memberId) {
  const role = await accessService.assertAccess(userId, memberId, 'grant');
  const links = await UserMemberLink.findAll({
    where: { memberId },
    include: [{ association: 'user', attributes: ['id', 'username', 'displayName'] }],
    order: [['createdAt', 'ASC']]
  });
  return links.map((l) => ({
    id: l.id, userId: l.userId, username: l.user?.username, displayName: l.user?.displayName,
    role: l.role, relationship: l.relationship, createdAt: l.createdAt
  }));
}

async function grantLink(userId, memberId, { granteeUserId, role, relationship = '家人' }) {
  const myRole = await accessService.assertAccess(userId, memberId, 'grant');
  if (!['viewer', 'editor', 'owner', 'self'].includes(role)) throw new HttpError(400, '无效的授权角色');
  const isOwnerOrSelf = myRole === 'self' || myRole === 'owner';
  if (isOwnerOrSelf && !['viewer', 'editor'].includes(role)) {
    throw new HttpError(403, '只有管理员可以授予该角色');
  }
  const grantee = await User.findByPk(granteeUserId);
  if (!grantee) throw new HttpError(400, '目标用户不存在');
  if (role === 'self') {
    const claimed = await UserMemberLink.findOne({ where: { memberId, role: 'self' } });
    if (claimed) throw new HttpError(409, '该成员已绑定账户');
  }
  const existing = await UserMemberLink.findOne({ where: { userId: granteeUserId, memberId } });
  if (existing) throw new HttpError(409, '该用户已有此成员的授权');
  return UserMemberLink.create({ userId: granteeUserId, memberId, role, relationship });
}

async function revokeLink(userId, memberId, linkId) {
  await accessService.assertAccess(userId, memberId, 'grant');
  const link = await UserMemberLink.findOne({ where: { id: linkId, memberId } });
  if (!link) throw new HttpError(404, '授权记录不存在');
  const user = await User.findByPk(userId, { attributes: ['role'] });
  if (link.role === 'self' && user.role !== 'admin') {
    throw new HttpError(403, '本人绑定只能由管理员解除');
  }
  await link.destroy();
}

async function merge(userId, { sourceId, targetId }) {
  const user = await User.findByPk(userId, { attributes: ['role'] });
  if (user.role !== 'admin') throw new HttpError(403, '只有管理员可以合并成员');
  if (!sourceId || !targetId || sourceId === targetId) throw new HttpError(400, '无效的合并参数');
  const source = await FamilyMember.findByPk(sourceId);
  const target = await FamilyMember.findByPk(targetId);
  if (!source || !target) throw new HttpError(404, '成员不存在');

  await sequelize.transaction(async (t) => {
    await MedicalReport.update({ memberId: targetId }, { where: { memberId: sourceId }, transaction: t });
    await Medication.update({ memberId: targetId }, { where: { memberId: sourceId }, transaction: t });
    await MedicalLog.update({ memberId: targetId }, { where: { memberId: sourceId }, transaction: t });

    const links = await UserMemberLink.findAll({ where: { memberId: sourceId }, transaction: t });
    for (const link of links) {
      const existing = await UserMemberLink.findOne({
        where: { memberId: targetId, userId: link.userId }, transaction: t });
      if (!existing) {
        await UserMemberLink.create(
          { userId: link.userId, memberId: targetId, role: link.role, relationship: link.relationship },
          { transaction: t });
      } else if (link.role === 'self') {
        // target 已有绑定:保留 target 的 self,source 的降级 owner
        if (existing.role !== 'self') {
          await existing.update({ role: 'self', relationship: link.relationship }, { transaction: t });
          // 原 self 用户在 target 上的其他角色冲突由唯一约束排除(同 userId 只一条 link)
        }
      } else if (ROLE_RANK[link.role] > ROLE_RANK[existing.role] && existing.role !== 'self') {
        await existing.update({ role: link.role, relationship: link.relationship }, { transaction: t });
      }
      await link.destroy({ transaction: t });
    }
    await source.destroy({ transaction: t });
  });
}
```
路由(members.js,注意 `POST /merge` 要放在 `/:id` 之前):
```js
router.post('/merge', authenticateToken, c.merge);
router.post('/bind-self', authenticateToken, c.bindSelf); // Task 9 已建
router.get('/:id/links', authenticateToken, c.listLinks);
router.post('/:id/links', authenticateToken, c.grantLink);
router.delete('/:id/links/:linkId', authenticateToken, c.revokeLink);
```
注:merge 中 source 的 self link 用户若在 target 已有非 self link,`existing.update({role:'self'})` 后该用户 target link 唯一性成立(同 userId 同 memberId 只一条)。

- [ ] **Step 4: 测试通过 + 提交**

```bash
cd server && npm test
git add -A server && git commit -m "feat(server): member links grant/revoke + admin merge endpoint"
```

### Task 12: invites + users 管理 API(admin)

**Files:**
- Create: `server/src/controllers/invitesController.js`、`server/src/controllers/usersController.js`、`server/src/routes/invites.js`、`server/src/routes/users.js`
- Create: `server/src/middleware/admin.js`
- Modify: `server/src/app.js`
- Test: `server/tests/admin-api.test.js`

**Interfaces:**
- Produces:
  - `requireAdmin` middleware(authenticateToken 后校验 `req.user.role === 'admin'`,否则 403;authenticateToken 需同时把 role 放进 req.user)
  - `GET /api/invites`(列表,含 createdBy/member/usage)、`POST /api/invites` `{memberId?, maxUses?, expiresDays?}`、`DELETE /api/invites/:id`(停用)——均 admin
  - `GET /api/users`:**登录即可**(普通授权操作需要选人),所有人拿到 `{id, username, displayName}`;admin 额外拿到 `role/createdAt/selfMember`
  - `PUT /api/users/:id/role` `{role}`:仅 admin
- Consumes: Task 8 inviteService

- [ ] **Step 1: 写失败测试**

`server/tests/admin-api.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');

test('非 admin:invites 403;users 基础字段可见;改角色 403', async () => {
  const app = await getTestApp();
  const admin = await createAdmin('apiadmin');
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser('plain', { inviteCode: inv.code, memberData: { name: 'plain本人', gender: '男' } });
  const t = reg.body.data.token;
  assert.strictEqual((await auth(request(app).get('/api/invites'), t)).status, 403);
  const users = await auth(request(app).get('/api/users'), t);
  assert.strictEqual(users.status, 200);
  assert.ok(users.body.data.some((u) => u.username === 'plain'));
  assert.ok(users.body.data.every((u) => !('role' in u)), '普通用户不应看到 role 字段');
  assert.strictEqual((await auth(request(app).put(`/api/users/${admin.userId}/role`), t).send({ role: 'member' })).status, 403);
});

test('admin 邀请码全流程与用户角色切换', async () => {
  const app = await getTestApp();
  const admin = await createAdmin('apiadmin2');
  const created = await auth(request(app).post('/api/invites'), admin.token)
    .send({ maxUses: 3, expiresDays: 7 });
  assert.strictEqual(created.status, 201);
  const list = await auth(request(app).get('/api/invites'), admin.token);
  assert.strictEqual(list.status, 200);
  assert.ok(list.body.data.some((i) => i.code === created.body.data.code));

  const reg = await createUser('promote', {
    inviteCode: created.body.data.code, memberData: { name: 'promote本人', gender: '男' } });
  const uid = reg.body.data.user.id;
  const users = await auth(request(app).get('/api/users'), admin.token);
  assert.ok(users.body.data.some((u) => u.id === uid && u.role === 'member'));

  const promote = await auth(request(app).put(`/api/users/${uid}/role`), admin.token).send({ role: 'admin' });
  assert.strictEqual(promote.status, 200);
  const users2 = await auth(request(app).get('/api/users'), admin.token);
  assert.ok(users2.body.data.some((u) => u.id === uid && u.role === 'admin'));

  const stop = await auth(request(app).delete(`/api/invites/${created.body.data.id}`), admin.token);
  assert.strictEqual(stop.status, 200);
  const used = await createUser('stopped', {
    inviteCode: created.body.data.code, memberData: { name: 'stopped本人', gender: '男' } });
  assert.strictEqual(used.status, 400); // 仍剩次数但已停用
});
```

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现**

`server/src/middleware/admin.js`:
```js
const { authenticateToken } = require('./auth');
const HttpError = require('../utils/httpError');

const requireAdmin = [authenticateToken, (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new HttpError(403, '需要管理员权限'));
  }
  next();
}];
module.exports = { requireAdmin };
```
(auth.js 的 authenticateToken 中 `req.user = { id, username }` 扩为 `{ id, username, displayName, role }`。)

`invitesController`:list→`inviteService.listInvites()`;create→`createInvite({ createdById: req.user.id, memberId, maxUses, expiresAt: expiresDays ? new Date(Date.now() + expiresDays*86400000) : null })`;remove→`deactivate`。

`usersController`:
```js
// GET /api/users:登录即可;admin 视角多返回管理字段
exports.list = [authenticateToken, asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const users = await User.findAll({
    attributes: isAdmin
      ? ['id', 'username', 'displayName', 'role', 'createdAt']
      : ['id', 'username', 'displayName'],
    order: [['createdAt', 'ASC']]
  });
  let data = users.map((u) => u.toJSON());
  if (isAdmin) {
    const links = await UserMemberLink.findAll({
      where: { role: 'self' },
      include: [{ model: FamilyMember, as: 'member', attributes: ['id', 'name'] }]
    });
    const selfByUser = new Map(links.map((l) => [l.userId, l.member]));
    data = data.map((u) => ({ ...u, selfMember: selfByUser.get(u.id) || null }));
  }
  res.json({ success: true, data });
})];

exports.setRole = [requireAdmin, asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) throw new HttpError(400, '无效角色');
  const user = await User.findByPk(req.params.id);
  if (!user) throw new HttpError(404, '用户不存在');
  if (user.id === req.user.id) throw new HttpError(400, '不能修改自己的角色');
  await user.update({ role });
  res.json({ success: true, message: '角色已更新' });
})];
```
app.js 挂载 `app.use('/api/users', userRoutes); app.use('/api/invites', inviteRoutes);`。

- [ ] **Step 4: 测试通过 + 提交**

```bash
cd server && npm test
git add -A server && git commit -m "feat(server): admin invites + users management API"
```

### Task 13: reports/medications/medicalLogs 权限切换 + 模型去 legacy 列 + migrate --finalize

**Files:**
- Modify: `server/src/services/reportService.js`、`medicationService.js`、`medicalLogService.js`;`server/src/models/FamilyMember.js`;`server/src/models/index.js`(删旧关联)
- Test: `server/tests/cross-permission.test.js`
- 运行:`npm run migrate-v2 -- --finalize`(开发库)

**Interfaces:**
- Produces: 全部数据接口经 accessService;FamilyMember 模型不再有 userId/relationship 字段
- Consumes: Task 6 accessService、Task 7 finalizeV2

- [ ] **Step 1: 写失败测试(跨权限场景)**

`server/tests/cross-permission.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { getTestApp, createAdmin, createUser, auth, request } = require('./helpers/app');
const inviteService = require('../src/services/inviteService');

async function setup() {
  const app = await getTestApp();
  const admin = await createAdmin('xadmin');
  return { app, admin };
}
async function makeUser(app, admin, username) {
  const inv = await inviteService.createInvite({ createdById: admin.userId });
  const reg = await createUser(username, { inviteCode: inv.code, memberData: { name: `${username}本人`, gender: '男' } });
  return { token: reg.body.data.token, userId: reg.body.data.user.id };
}

test('viewer 可看报告但不可上传/编辑;editor 可上传;陌生人 404', async () => {
  const { app, admin } = await setup();
  const owner = await makeUser(app, admin, 'repOwner');
  const created = await auth(request(app).post('/api/members'), owner.token)
    .send({ name: '报告权限对象', gender: '男', relationship: '父亲' });
  const mid = created.body.data.id;
  const rep = await auth(request(app).post('/api/reports'), owner.token)
    .field('familyMemberId', String(mid)).field('reportDate', '2026-10-03');
  assert.strictEqual(rep.status, 201);

  const viewer = await makeUser(app, admin, 'repViewer');
  await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: viewer.userId, role: 'viewer' });
  // viewer 列表可见 + 详情可见
  const list = await auth(request(app).get('/api/reports'), viewer.token);
  assert.ok(list.body.data.some((r) => r.id === rep.body.data.id));
  const detail = await auth(request(app).get(`/api/reports/${rep.body.data.id}`), viewer.token);
  assert.strictEqual(detail.status, 200);
  // viewer 不可上传
  const denied = await auth(request(app).post('/api/reports'), viewer.token)
    .field('familyMemberId', String(mid)).field('reportDate', '2026-10-03');
  assert.strictEqual(denied.status, 403);
  // viewer 不可编辑
  const upd = await auth(request(app).put(`/api/reports/${rep.body.data.id}`), viewer.token)
    .field('hospitalName', 'x医院');
  assert.strictEqual(upd.status, 403);
  // editor 可上传
  const editor = await makeUser(app, admin, 'repEditor');
  await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: editor.userId, role: 'editor' });
  const okUpload = await auth(request(app).post('/api/reports'), editor.token)
    .field('familyMemberId', String(mid)).field('reportDate', '2026-10-04');
  assert.strictEqual(okUpload.status, 201);
  // 陌生人 404
  const stranger = await makeUser(app, admin, 'repStranger');
  const gone = await auth(request(app).get(`/api/reports/${rep.body.data.id}`), stranger.token);
  assert.strictEqual(gone.status, 404);
});

test('medications/medicalLogs 同权限模型', async () => {
  const { app, admin } = await setup();
  const owner = await makeUser(app, admin, 'medOwner');
  const created = await auth(request(app).post('/api/members'), owner.token)
    .send({ name: '用药权限对象', gender: '男', relationship: '母亲' });
  const mid = created.body.data.id;
  const viewer = await makeUser(app, admin, 'medViewer');
  await auth(request(app).post(`/api/members/${mid}/links`), owner.token)
    .send({ granteeUserId: viewer.userId, role: 'viewer' });
  const list = await auth(request(app).get(`/api/medications/member/${mid}`), viewer.token);
  assert.strictEqual(list.status, 200);
  const create = await auth(request(app).post('/api/medications'), viewer.token)
    .send({ memberId: mid, name: '药', dosage: '1', frequency: '日' });
  assert.strictEqual(create.status, 403);
});
```

- [ ] **Step 2: 运行确认失败(旧 userId 过滤下 viewer 场景失败)**

- [ ] **Step 3: 切换权限实现**

三个 service 统一改法:
- **列表**:`const ids = await accessService.getVisibleMemberIds(userId);` 查询 `where: { memberId: ids }`(或按 member 查询时先判断 `ids.includes(memberId)`);`include FamilyMember` 去掉 `where: { userId }`
- **按 id 的读/写/删**:`await accessService.assertAccess(userId, memberId, 'view' | 'edit')`(报告删除用 'edit';medication/log 同理)
- medications/medicalLogs 的 `GET /member/:memberId`:`assertAccess(userId, memberId, 'view')` 后查询

`FamilyMember.js` 模型:删除 `userId` 与 `relationship` 字段定义(含 indexes 中 `fields: ['userId']` 改为无或删除);`models/index.js` 删除 `FamilyMember.belongsTo(User...)` / `User.hasMany(FamilyMembers...)` 两行旧关联。

- [ ] **Step 4: 全量测试 + 开发库 finalize + 手动冒烟**

```bash
cd server && npm test
npm run migrate-v2 -- --finalize   # 开发库删除 legacy 列(先自动备份)
npm run dev   # 冒烟:启动、登录、成员列表、报告列表正常
```

- [ ] **Step 5: Commit**

```bash
git add -A server && git commit -m "feat(server): switch all data routes to accessService, drop legacy member columns"
```

### Task 14: 前端 Vite 迁移 + vitest 基建(行为不变)

**Files:**
- Create: `client/vite.config.js`、`client/index.html`、`client/src/main.jsx`(由 index.js 改名)、`client/src/setupTests.js`
- Modify: `client/package.json`、`client/src/services/api.js`(env 前缀)
- Delete: `client/public/index.html`、`client/src/index.js`、`client/src/reportWebVitals.js`(若存在)、`client/src/setupTests.js`(CRA 版本若冲突)
- Test: `client/src/utils/__tests__/smoke.test.js`

**Interfaces:**
- Produces: `npm run dev`(vite,端口 3000,proxy /api→3001)、`npm run build`、`npm test`(vitest)
- Consumes: 无(纯前端基建)

- [ ] **Step 1: 依赖切换**

```bash
cd client
npm uninstall react-scripts web-vitals
npm install --save-dev vite @vitejs/plugin-react vitest jsdom @testing-library/jest-dom
npm install @ant-design/icons
```

`client/package.json` scripts 与配置替换为:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```
删除 `eslintConfig`、`browserslist` 字段(vite 不需要)。

- [ ] **Step 2: 配置文件**

`client/vite.config.js`:
```js
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: { '/api': 'http://localhost:3001' }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js'
  }
});
```

`client/index.html`(根目录):
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <title>MedCare 家庭健康</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```
注:vite 中 `%PUBLIC_URL%` 不可用,改为 `/favicon.ico`;public/ 目录其余文件 vite 自动按根路径服务。

`client/src/main.jsx` = 原 index.js 内容不变(文件改名);删除其中的 `reportWebVitals` 引用(若有)。

`client/src/services/api.js` 第 29 行:
```js
baseURL: import.meta.env.VITE_API_URL || '/api',
```

`client/src/setupTests.js`:
```js
import '@testing-library/jest-dom';
```

- [ ] **Step 3: 冒烟测试**

`client/src/utils/__tests__/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('vitest 基建', () => {
  it('正常运行', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: 验证三件事**

```bash
cd client && npm test          # vitest PASS
npm run dev                     # 打开 http://localhost:3000(后端另起),登录可用
npm run build                   # 构建成功,产物在 client/dist
```
注:构建产物从 `build/` 变为 `dist/`——根 README 的部署命令、Dockerfile 中 `cp -r build ../server/public/` 改为 `dist`(Dockerfile 同步修改,若引用)。

- [ ] **Step 5: Commit**

```bash
git add -A client Dockerfile docker-compose.yml 2>/dev/null; git add -A client
git commit -m "build(client): migrate CRA to Vite with vitest, dev proxy, port 3000"
```

### Task 15: authSlice v2 + memberSlice + API 路径切换

**Files:**
- Modify: `client/src/services/authAPI.js`(+me/previewInvite/register 新参数)、`client/src/services/familyMemberAPI.js` → 重命名 `client/src/api/memberAPI.js`、`client/src/api/inviteAPI.js`、`client/src/api/userAPI.js`(新建目录 `client/src/api/`,把 `services/*.js` 全部迁入并统一改名为 `api/`)
- Modify: `client/src/store/slices/authSlice.js`、`familyMemberSlice.js` → `memberSlice.js`
- Modify: 所有引用 `services/` 与 `familyMemberSlice` 的页面(reports/dashboard/familyMembers 页等,全局搜索替换)
- Test: `client/src/store/__tests__/authSlice.test.js`

**Interfaces:**
- Produces:
  - `authSlice` state 增加 `role`、`selfMember`;`checkAuthStatus` 改调 `GET /auth/me`
  - `memberAPI.list()` → `/members`;`memberAPI` 其余方法路径 `/members/...`
  - `inviteAPI`:list/create/remove;`userAPI`:list/setRole
  - 组件统一从 `../../api/*` 导入
- Consumes: Task 9 后端 API

- [ ] **Step 1: 写 authSlice 测试**

`client/src/store/__tests__/authSlice.test.js`:
```js
import { describe, it, expect } from 'vitest';
import reducer, { handleAuthExpired } from '../authSlice';

describe('authSlice', () => {
  const initial = {
    user: { id: 1, username: 'a', role: 'admin' },
    token: 't', selfMember: { id: 9, name: 'A' },
    isAuthenticated: true, isLoading: false, needsSetup: false, error: null, logoutReason: null
  };
  it('handleAuthExpired 清空并记录原因', () => {
    const s = reducer(initial, handleAuthExpired());
    expect(s.isAuthenticated).toBe(false);
    expect(s.logoutReason).toBe('token_expired');
  });
});
```

- [ ] **Step 2: 目录迁移**

```bash
cd client/src && mkdir api && git mv services/*.js api/ && rmdir services 2>/dev/null || true
```
全局替换引用:`from '../../services/` → `from '../../api/`;`from '../services/` → `from '../api/`(页面与 slice 全部)。

- [ ] **Step 3: authSlice/memberSlice 改造**

authSlice 关键 diff:
- `initialState` 增加 `selfMember: null`
- `checkAuthStatus` 内 token 有效时调 `authAPI.me()`,payload 为 `{ isAuthenticated: true, user: me.user, selfMember: me.selfMember, token }`
- `login/register` fulfilled 存 `role` 与 `selfMember`(register 响应在 Task 9 已含 user.role;login 响应需后端补 selfMember——**后端 login 响应 data 增加 `user.role` 与 `selfMember`**,在后端 `login` 实现中一并返回,此处同步)
- `logout/handleAuthExpired` 置空 `selfMember`

后端补丁(小):`authController.login` 响应:
```js
data: { user: { id, username, displayName, role }, selfMember: await accessService.getSelfMember(user.id), token }
```

memberSlice(原 familyMemberSlice 改名,state 键 `familyMembers` → `members`,但为减少页面改动,**保留 slice 名 `familyMembers` 与 state 键,仅改 API 路径与新增 role 字段**——重命名收益低、改动面大,不值得)。决定:**不重命名 slice**,只把 `familyMemberAPI` 内路径 `/family-members` → `/members`,文件移入 api/ 目录。成员项新增 `role`/`relationship` 字段自动透传。

`client/src/api/authAPI.js` 增加:
```js
const me = () => api.get('/auth/me');
const previewInvite = (inviteCode) => api.post('/auth/preview-invite', { inviteCode });
// register(payload) 不变,payload 由注册页组装新结构
```

`client/src/api/memberAPI.js`:全部 URL 前缀改 `/members`;新增 `bindSelf(payload)`。

`client/src/api/inviteAPI.js`(新):
```js
import api from './api';
export default {
  list: () => api.get('/invites'),
  create: (data) => api.post('/invites', data),
  remove: (id) => api.delete(`/invites/${id}`)
};
```
`client/src/api/userAPI.js`(新):
```js
import api from './api';
export default {
  list: () => api.get('/users'),
  setRole: (id, role) => api.put(`/users/${id}/role`, { role })
};
```

- [ ] **Step 3.5: Dashboard 默认成员 = 本人**

`Dashboard.js` 成员选择器初始值:`selfMember?.id ?? 'all'`(从 `state.auth.selfMember` 取)。

- [ ] **Step 4: 验证 + 提交**

```bash
cd client && npm test && npm run build
# 手动:dev 起前后端,登录 → 仪表盘/成员/报告页正常,网络面板确认请求走 /api/members
git add -A client server && git commit -m "feat(client): auth v2 state (role/selfMember), api/ dir, /members paths"
```

### Task 16: AppLayout 响应式(桌面 Sider / 移动端 TabBar)

**Files:**
- Create: `client/src/hooks/useBreakpoint.js`、`client/src/components/layout/MobileTabBar.js`
- Modify: `client/src/components/Layout/MainLayout.js`(改名 `client/src/components/layout/AppLayout.js`,更新引用)、`client/src/App.js`
- Test: 手动验证(响应式布局)

**Interfaces:**
- Produces: `AppLayout`(内部按断点渲染 Sider 布局或 Header+TabBar);`useBreakpoint()` → `{ isMobile }`
- Consumes: Task 15 authSlice(selfMember 展示)

- [ ] **Step 1: useBreakpoint hook**

`client/src/hooks/useBreakpoint.js`:
```js
import { useState, useEffect } from 'react';

const QUERY = '(max-width: 767px)';

export default function useBreakpoint() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return { isMobile };
}
```

- [ ] **Step 2: MobileTabBar**

`client/src/components/layout/MobileTabBar.js`:
```jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TabBar } from 'antd';
import {
  DashboardOutlined, FileTextOutlined, PlusOutlined, TeamOutlined, UserOutlined
} from '@ant-design/icons';

export default function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeKey = ['/', '/dashboard', '/reports', '/family-members', '/settings', '/upload']
    .filter((p) => location.pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0] || '/dashboard';

  return (
    <TabBar
      activeKey={activeKey}
      onChange={(key) => key === '__upload' ? navigate('/upload/quick') : navigate(key)}
      style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: '#fff',
               paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <TabBar.Item key="/dashboard" icon={<DashboardOutlined />} title="首页" />
      <TabBar.Item key="/reports" icon={<FileTextOutlined />} title="报告" />
      <TabBar.Item key="__upload" icon={
        <div style={{
          width: 44, height: 44, borderRadius: 22, marginTop: -18,
          background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(6,182,212,0.4)'
        }}><PlusOutlined style={{ color: '#fff', fontSize: 20 }} /></div>
      } title="上传" />
      <TabBar.Item key="/family-members" icon={<TeamOutlined />} title="成员" />
      <TabBar.Item key="/settings" icon={<UserOutlined />} title="我的" />
    </TabBar>
  );
}
```

- [ ] **Step 3: AppLayout 组合**

`AppLayout.js`(原 MainLayout 改造):保留现有 Sider 结构,顶层:
```jsx
const { isMobile } = useBreakpoint();
if (isMobile) {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header style={{ padding: '0 16px', background: '#fff', position: 'sticky', top: 0, zIndex: 9,
                       height: 52, lineHeight: '52px', display: 'flex', alignItems: 'center',
                       justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>MedCare</span>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Avatar style={{ backgroundColor: '#3b82f6' }} size={30}>
            {(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
          </Avatar>
        </Dropdown>
      </Header>
      <Content style={{ padding: 12, paddingBottom: 80, minHeight: 'calc(100vh - 52px)', overflow: 'auto' }}>
        <Outlet />
      </Content>
      <MobileTabBar />
    </Layout>
  );
}
// 桌面:原 Sider 布局代码原样
```
`App.js` 引用与路由保持(`MainLayout` → `AppLayout` 重命名后同步 import);`App.js` 新增路由:
```jsx
<Route path="upload/quick" element={<QuickUpload />} />
```
(QuickUpload 占位页 Task 17 实现;本 Task 先建 `client/src/pages/Reports/QuickUpload.js` 返回 `<div>快速上传(建设中)</div>` 防路由报错。)

- [ ] **Step 4: 手动验证(Chrome DevTools iPhone 尺寸)+ 提交**

验证点:TabBar 5 项可见、中心按钮凸起可点、切换路由正确、桌面端布局不变。

```bash
git add -A client && git commit -m "feat(client): responsive AppLayout with mobile TabBar and center upload button"
```

### Task 17: 注册两步向导(邀请码 + 新建/认领)

**Files:**
- Rewrite: `client/src/pages/Auth/Register.js`
- Test: `client/src/pages/Auth/__tests__/Register.test.js`(逻辑抽取部分)

**Interfaces:**
- Produces: `/register` 两步向导;`needsSetup`(首账户)时隐藏邀请码输入
- Consumes: `authAPI.previewInvite`、`authSlice.register`(payload:`{username, password, inviteCode?, mode, memberData?, claimMemberId?}`)

- [ ] **Step 1: 抽取纯逻辑 + 测试**

`client/src/pages/Auth/registerFormLogic.js`:
```js
// 根据预检结果决定第二步的可用模式
export function resolveBindOptions(preview) {
  if (!preview) return { canCreate: true, canClaim: false, boundMember: null, claimable: [] };
  if (preview.boundMember) {
    return { canCreate: false, canClaim: true, boundMember: preview.boundMember, claimable: [preview.boundMember] };
  }
  return { canCreate: true, canClaim: (preview.claimableMembers || []).length > 0,
           boundMember: null, claimable: preview.claimableMembers || [] };
}

export function buildRegisterPayload({ username, password, inviteCode, mode, newMember, claimMemberId, needsSetup }) {
  return {
    username, password,
    inviteCode: needsSetup ? undefined : inviteCode,
    mode,
    memberData: mode === 'create' ? newMember : undefined,
    claimMemberId: mode === 'claim' ? claimMemberId : undefined
  };
}
```
`__tests__/Register.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { resolveBindOptions, buildRegisterPayload } from '../registerFormLogic';

describe('resolveBindOptions', () => {
  it('专属码 → 只能认领指定成员', () => {
    const r = resolveBindOptions({ boundMember: { id: 1, name: '爸' } });
    expect(r.canClaim).toBe(true);
    expect(r.canCreate).toBe(false);
  });
  it('通用码且有可认领 → 两种模式', () => {
    const r = resolveBindOptions({ claimableMembers: [{ id: 2 }] });
    expect(r.canCreate).toBe(true);
    expect(r.canClaim).toBe(true);
  });
  it('通用码且无可认领 → 只能新建', () => {
    const r = resolveBindOptions({ claimableMembers: [] });
    expect(r.canClaim).toBe(false);
  });
});

describe('buildRegisterPayload', () => {
  it('needsSetup 时不带邀请码', () => {
    const p = buildRegisterPayload({ username: 'a', password: '123456', inviteCode: 'X',
      mode: 'create', newMember: { name: 'A', gender: '男' }, needsSetup: true });
    expect(p.inviteCode).toBeUndefined();
    expect(p.memberData).toEqual({ name: 'A', gender: '男' });
  });
});
```

- [ ] **Step 2: 运行测试通过**

```bash
cd client && npx vitest run src/pages/Auth
```

- [ ] **Step 3: 重写 Register.js(antd Steps 两步)**

结构要点(样式沿用现有登录卡片风格):
```jsx
const [step, setStep] = useState(0);
const [inviteCode, setInviteCode] = useState('');
const [preview, setPreview] = useState(null);
const [mode, setMode] = useState('create');      // create | claim
const [newMember, setNewMember] = useState({ name: '', gender: undefined, birthday: null });
const [claimMemberId, setClaimMemberId] = useState(null);
const options = resolveBindOptions(preview);

// Step 0: username + password(+ 邀请码,当 !needsSetup)
// 「下一步」时若需要邀请码 → authAPI.previewInvite(inviteCode) → setPreview;失败 message.error 停留
// Step 1: Radio.Group 模式选择(options 里禁用不可用项)
//   mode=create → Form: 姓名/性别(Radio 男/女/其他)/生日(DatePicker,可选)
//   mode=claim  → 成员卡列表(claimable,含姓名/性别/年龄),点击选中
//   提交 → dispatch(register(buildRegisterPayload({...}))) → 成功跳 /
```
needsSetup 判定沿用现有 `checkInitStatus`(slice 已有)。

- [ ] **Step 4: 手动全流程验证 + 提交**

后端造码:`node -e` 或用 admin 登录后 curl `POST /api/invites`。验证:首账户初始化(无码)→ 专属码认领 → 通用码新建 → 错码报错。

```bash
git add -A client && git commit -m "feat(client): two-step registration wizard with invite preview and claim"
```

### Task 18: 快速上传向导(/upload/quick)+ IndicatorEditTable 抽取

**Files:**
- Create: `client/src/pages/Reports/QuickUpload.js`、`client/src/components/common/IndicatorEditTable.js`、`client/src/utils/quickUploadMachine.js`
- Modify: `client/src/pages/Reports/ReportUpload.js`(改用共享组件)、`client/src/pages/Reports/ReportEdit.js`(同)
- Test: `client/src/utils/__tests__/quickUploadMachine.test.js`

**Interfaces:**
- Produces:
  - `quickUploadMachine.js`:`reduceStage(stage, event)` 纯函数;stage ∈ `'capture'|'recognizing'|'review'|'done'|'error'`,event ∈ `'START'|'FILE_PICKED'|'OCR_OK'|'OCR_FAIL'|'RETRY'|'SUBMIT_OK'|'SUBMIT_FAIL'|'RESET'`
  - `IndicatorEditTable` props:`{ indicators, value, onChange, onCreateIndicator }`(value 为指标行数组,结构同现有 indicatorData)
  - `/upload/quick` 页面:拍照/选图 → OCR → 确认(成员默认本人)→ 保存 → 再拍一张
- Consumes: `ocrAPI.recognizeAndParse`、`reportAPI.createReport`(FormData 提交,复用 reportSlice.createReport thunk)、`state.auth.selfMember`、`state.familyMembers.list`

- [ ] **Step 1: 状态机测试**

`client/src/utils/__tests__/quickUploadMachine.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { reduceStage } from '../quickUploadMachine';

describe('quickUploadMachine', () => {
  it('正常流', () => {
    expect(reduceStage('capture', 'FILE_PICKED')).toBe('recognizing');
    expect(reduceStage('recognizing', 'OCR_OK')).toBe('review');
    expect(reduceStage('review', 'SUBMIT_OK')).toBe('done');
    expect(reduceStage('done', 'RESET')).toBe('capture');
  });
  it('OCR 失败 → error,RETRY 回 capture(保留文件由组件层负责),也可跳过', () => {
    expect(reduceStage('recognizing', 'OCR_FAIL')).toBe('error');
    expect(reduceStage('error', 'RETRY')).toBe('capture');
  });
  it('提交失败 → 回 review 可改后重试', () => {
    expect(reduceStage('review', 'SUBMIT_FAIL')).toBe('review');
  });
  it('非法迁移保持原状态', () => {
    expect(reduceStage('capture', 'OCR_OK')).toBe('capture');
  });
});
```

- [ ] **Step 2: 实现状态机**

`client/src/utils/quickUploadMachine.js`:
```js
const TRANSITIONS = {
  capture:     { FILE_PICKED: 'recognizing', RESET: 'capture' },
  recognizing: { OCR_OK: 'review', OCR_FAIL: 'error' },
  error:       { RETRY: 'capture', SKIP: 'review' },   // SKIP = 跳过识别手动填写
  review:      { SUBMIT_OK: 'done', SUBMIT_FAIL: 'review' },
  done:        { NEXT_FILE: 'recognizing', RESET: 'capture' } // NEXT_FILE = 队列中还有照片
};

export function reduceStage(stage, event) {
  return (TRANSITIONS[stage] && TRANSITIONS[stage][event]) || stage;
}
```
状态机测试补两条:
```js
it('OCR 失败可跳过识别直接进确认', () => {
  expect(reduceStage('error', 'SKIP')).toBe('review');
});
it('多选照片:保存后自动进入下一张', () => {
  expect(reduceStage('done', 'NEXT_FILE')).toBe('recognizing');
});
```
运行 `npx vitest run src/utils` 至 PASS。

- [ ] **Step 3: 抽取 IndicatorEditTable**

从 `ReportUpload.js` 抽出指标表格与行编辑逻辑(行结构 `{id, indicatorId, value, referenceRange, isNormal, abnormalType, notes, ocrMatched, ocrName}`):
- 组件持有:Table 列定义(指标选择 Select/ AutoComplete、数值 Input、参考范围、异常 Tag、删除按钮)、`handleIndicatorChange`、`checkAbnormalStatus`(指标自动判异常)
- Props:`indicators`(指标库)、`value/onChange`(受控)、`onCreateIndicator(rowId, info)`(新建指标回调)
- `ReportUpload.js` 与 `ReportEdit.js` 中原内联表格替换为该组件(行为不变,提交数据结构不变)

- [ ] **Step 4: 实现 QuickUpload**

`client/src/pages/Reports/QuickUpload.js`(核心结构):
```jsx
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Select, DatePicker, Collapse, Input, Result, Spin, message, Card, Space } from 'antd';
import dayjs from 'dayjs';
import { CameraOutlined, ReloadOutlined, CheckOutlined } from '@ant-design/icons';
import { reduceStage } from '../../utils/quickUploadMachine';
import { createReport } from '../../store/slices/reportSlice';
import { fetchFamilyMembers } from '../../store/slices/familyMemberSlice';
import { fetchIndicators } from '../../store/slices/indicatorSlice';
import IndicatorEditTable from '../../components/common/IndicatorEditTable';
import ocrAPI from '../../api/ocrAPI';

export default function QuickUpload() {
  const [stage, setStage] = useState('capture');
  const [file, setFile] = useState(null);
  const [ocrIndicators, setOcrIndicators] = useState([]);
  const [memberId, setMemberId] = useState(null);
  const [reportDate, setReportDate] = useState(dayjs());
  const [hospital, setHospital] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, selfMember } = useSelector((s) => s.auth);
  const { list: members } = useSelector((s) => s.familyMembers);
  const { list: indicators } = useSelector((s) => s.indicators);

  React.useEffect(() => { dispatch(fetchFamilyMembers()); dispatch(fetchIndicators()); }, [dispatch]);
  React.useEffect(() => { if (selfMember?.id) setMemberId(selfMember.id); }, [selfMember]);

  // 多选:第一张立即处理,其余入队
  const [queue, setQueue] = useState([]);

  const recognize = (f) => {
    setFile(f);
    ocrAPI.recognizeAndParse(f)
      .then((res) => {
        if (res.success && res.data) {
          setOcrIndicators(res.data.indicators || []);
          setStage((s) => reduceStage(s, 'OCR_OK'));
        } else { throw new Error(res.message || 'OCR 识别失败'); }
      })
      .catch(() => { setStage((s) => reduceStage(s, 'OCR_FAIL')); });
  };

  const pick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';              // 允许连选同名文件
    const valid = files.filter((f) =>
      (f.type.startsWith('image/') || f.type === 'application/pdf') && f.size <= 10 * 1024 * 1024);
    if (valid.length < files.length) message.warning('已跳过不支持的文件(仅图片/PDF,≤10MB)');
    if (valid.length === 0) return;
    setStage(reduceStage(stage, 'FILE_PICKED'));
    setQueue(valid.slice(1));
    recognize(valid[0]);
  };

  const nextFile = () => {
    const [next, ...rest] = queue;
    if (!next) return;
    setQueue(rest);
    setOcrIndicators([]); setHospital(''); setNotes('');
    setStage(reduceStage('done', 'NEXT_FILE'));
    recognize(next);
  };

  const submit = async () => {
    if (!memberId) { message.warning('请选择成员'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('familyMemberId', memberId);
      fd.append('reportDate', reportDate.format('YYYY-MM-DD'));
      if (hospital) fd.append('hospitalName', hospital);
      if (notes) fd.append('notes', notes);
      const filtered = ocrIndicators.filter((i) => i.indicatorId && i.value !== '' && i.value != null);
      fd.append('indicatorData', JSON.stringify(filtered));
      if (file) fd.append('reportFile', file);
      await dispatch(createReport(fd)).unwrap();
      setStage((s) => reduceStage(s, 'SUBMIT_OK'));
    } catch (err) {
      message.error(err?.userMessage || err?.message || '保存失败');
      setStage((s) => reduceStage(s, 'SUBMIT_FAIL'));
    } finally { setSubmitting(false); }
  };

  const reset = () => {
    setFile(null); setOcrIndicators([]); setHospital(''); setNotes('');
    setStage((s) => reduceStage(s, 'RESET'));
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* 隐藏的相机/相册输入:capture 在移动端唤起相机,multiple 支持多页报告连拍 */}
      <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple
             capture="environment" style={{ display: 'none' }} onChange={pick} />

      {stage === 'capture' && (
        <Card>
          <Button type="primary" size="large" block icon={<CameraOutlined />}
                  style={{ height: 96, fontSize: 18, borderRadius: 16 }}
                  onClick={() => inputRef.current.click()}>
            拍照或选择报告
          </Button>
          <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 12 }}>
            支持检验报告拍照，自动识别指标
          </p>
        </Card>
      )}

      {stage === 'recognizing' && (
        <Card style={{ textAlign: 'center', padding: 32 }}><Spin size="large" />
          <p style={{ marginTop: 16 }}>正在识别报告内容…</p></Card>
      )}

      {stage === 'error' && (
        <Card style={{ textAlign: 'center' }}>
          <p>识别失败，可重试或跳过识别直接保存(照片已保留)</p>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => setStage(reduceStage(stage, 'RETRY'))}>重试</Button>
            <Button type="primary" onClick={() => { setOcrIndicators([]); setStage((s) => reduceStage(s, 'SKIP')); }}>
              跳过识别，手动填写
            </Button>
          </Space>
        </Card>
      )}

      {stage === 'review' && (
        <Card title="确认报告信息">
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6, color: '#64748b' }}>成员(默认本人)</div>
            <Select value={memberId} onChange={setMemberId} style={{ width: '100%' }} size="large"
              options={members.map((m) => ({ value: m.id, label: `${m.name}(${m.relationship || m.role})` }))} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6, color: '#64748b' }}>报告日期</div>
            <DatePicker value={reportDate} onChange={(d) => d && setReportDate(d)} style={{ width: '100%' }} size="large" />
          </div>
          <Collapse ghost items={[{ key: 'more', label: '医院 / 备注(可选)',
            children: (<>
              <Input placeholder="医院名称" value={hospital} onChange={(e) => setHospital(e.target.value)} style={{ marginBottom: 8 }} />
              <Input.TextArea placeholder="备注" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </>) }]} style={{ marginBottom: 12 }} />
          <IndicatorEditTable indicators={indicators} value={ocrIndicators} onChange={setOcrIndicators}
                              onCreateIndicator={async (rowId, info) => {
                                const res = await ocrAPI.createIndicator({ name: info.name, unit: info.unit || '', type: info.type || '血液', valueType: 'numeric', isDefault: false });
                                if (res.success) { dispatch(fetchIndicators());
                                  setOcrIndicators((prev) => prev.map((r) => r.id === rowId ? { ...r, indicatorId: res.data.id } : r)); }
                              }} />
          <Button type="primary" size="large" block loading={submitting} onClick={submit}
                  style={{ marginTop: 16, height: 48, borderRadius: 12 }}>
            保存报告
          </Button>
        </Card>
      )}

      {stage === 'done' && (
        <Result status="success" title="报告已保存"
          extra={<Space direction="vertical" style={{ width: '100%' }}>
            {queue.length > 0 && (
              <Button type="primary" size="large" block icon={<CameraOutlined />} onClick={nextFile}>
                下一张(还剩 {queue.length} 张)
              </Button>
            )}
            <Button type={queue.length ? 'default' : 'primary'} size="large" block icon={<CameraOutlined />} onClick={reset}>再拍一张</Button>
            <Button size="large" block onClick={() => navigate('/reports')}>完成</Button>
          </Space>} />
      )}
    </div>
  );
}
```
注:`createReport` thunk 接收 FormData 时需确认 reportSlice 现有实现对 FormData 透传(现有 ReportUpload 即如此提交,沿用)。

- [ ] **Step 5: 桌面入口互链 + 验证 + 提交**

`Reports.js` 工具栏加「快速上传」入口(移动端 TabBar 已直达);`QuickUpload` 顶部「完整模式」链接到 `/reports/upload`。
手动验证:移动端模拟器中拍照(jpg)→ OCR(PaddleOCR 可用则真识别,否则跳过识别路径)→ 默认成员=本人 → 保存 → 再拍一张。

```bash
cd client && npx vitest run && npm run build
git add -A client && git commit -m "feat(client): quick upload wizard with camera capture and shared indicator table"
```

### Task 19: 列表/表单移动端适配

**Files:**
- Modify: `client/src/pages/Reports/Reports.js`、`client/src/pages/FamilyMembers/FamilyMembers.js`、`client/src/pages/FamilyMembers/FamilyMemberDetail.js`、`client/src/pages/Reports/ReportDetail.js`、`client/src/pages/Dashboard/Dashboard.js`
- Test: 手动验证

**Interfaces:**
- Consumes: Task 16 `useBreakpoint`

- [ ] **Step 1: Reports 列表双形态**

`Reports.js`:
```jsx
const { isMobile } = useBreakpoint();
// isMobile ? 卡片列表 : 现有 Table(两者数据同源)
{isMobile ? (
  <List dataSource={filteredReports} renderItem={(r) => (
    <Card size="small" style={{ marginBottom: 8 }} onClick={() => navigate(`/reports/${r.id}`)}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{r.familyMember?.name || '—'}</div>
          <div style={{ color: '#64748b', fontSize: 12 }}>{r.reportDate} · {r.hospitalName || '未填医院'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Tag color={r.indicatorCount ? 'blue' : 'default'}>{r.indicatorCount || 0} 项指标</Tag>
        </div>
      </div>
    </Card>
  )} />
) : ( /* 现有 Table 原样 */ )}
```
(字段名以现有页面数据为准对齐。)

- [ ] **Step 2: FamilyMembers 同模式**

头像卡片(name/gender/age/relationship/role badge/viewer 标识);点击进详情。上传入口按钮(跳 `/upload/quick?memberId=`,QuickUpload 读 URL 参数预选成员——补 5 行:
```jsx
const preselected = new URLSearchParams(window.location.search).get('memberId');
useEffect(() => { if (preselected && members.some((m) => m.id === Number(preselected))) setMemberId(Number(preselected)); }, [preselected, members]);
```
)

- [ ] **Step 3: 详情/表单单列化**

`FamilyMemberDetail/ReportDetail/ReportEdit/FamilyMemberEdit`:antd Form `layout="vertical"`;`Row/Col` 的 Col span 在 isMobile 下强制 24;操作按钮 `block`;图表容器高度移动端 260px、桌面沿用现有。

- [ ] **Step 4: Dashboard 自适应**

ECharts 容器监听 resize(echarts-for-react 自动支持,只需容器宽度 100%);成员选择器默认 `selfMember?.id`;移动端统计卡片纵向堆叠。

- [ ] **Step 5: 手动验证 + 提交**

iPhone SE(375px)到桌面逐页检查;触摸目标≥44px。

```bash
git add -A client && git commit -m "feat(client): mobile-adaptive lists, detail forms and dashboard"
```

### Task 20: PWA(manifest + Service Worker + 图标 + 安装引导)

**Files:**
- Create: `client/scripts/generate-icons.js`、`client/public/pwa-192.png`、`client/public/pwa-512.png`、`client/public/apple-touch-icon.png`(脚本生成)
- Create: `client/src/components/common/InstallPrompt.jsx`
- Modify: `client/vite.config.js`(VitePWA)、`client/src/main.jsx`(SW 注册)

**Interfaces:**
- Produces: 可安装 PWA;SW 策略:precache app shell、导航 NetworkFirst→index.html、`/api/*` NetworkOnly
- Consumes: Task 14 vite

- [ ] **Step 1: 图标生成脚本(零依赖 PNG 编码)**

```bash
cd client && npm install --save-dev vite-plugin-pwa
node scripts/generate-icons.js   # 生成三个 PNG
```

`client/scripts/generate-icons.js`:
```js
// 零依赖生成 PWA 图标:渐变底 + 心形,Heart 隐式曲线 (x²+y²-1)³ - x²y³ ≤ 0
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePng(file, size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x / (size - 1), y / (size - 1));
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(path.join(__dirname, '..', 'public', file), png);
  console.log(`生成 ${file} (${size}x${size})`);
}
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
function pixel(nx, ny) {
  const x = nx * 2.8 - 1.4;
  const y = 1.4 - ny * 2.8;
  const inHeart = Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0;
  if (inHeart) return [255, 255, 255, 255];
  return [lerp(6, 59, ny), lerp(182, 130, ny), lerp(212, 246, ny), 255]; // #06b6d4 → #3b82f6
}
writePng('pwa-192.png', 192, pixel);
writePng('pwa-512.png', 512, pixel);
writePng('apple-touch-icon.png', 180, pixel);
```

- [ ] **Step 2: vite-plugin-pwa 配置**

`vite.config.js` plugins 增加:
```js
import { VitePWA } from 'vite-plugin-pwa';
// plugins: [react(), VitePWA({ ... })]
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['apple-touch-icon.png'],
  manifest: {
    name: 'MedCare 家庭健康',
    short_name: 'MedCare',
    description: '家庭健康管理与报告追踪',
    theme_color: '#3b82f6',
    background_color: '#f8fafc',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      { urlPattern: /\/api\//, handler: 'NetworkOnly' } // 健康数据不做离线缓存
    ]
  }
})
```

`client/src/main.jsx` 增加:
```js
import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });
```
`client/index.html` head 增加:
```html
<meta name="theme-color" content="#3b82f6" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

- [ ] **Step 3: InstallPrompt(iOS + 通用)**

`client/src/components/common/InstallPrompt.jsx`:
```jsx
import React, { useEffect, useState } from 'react';
import { Modal, Typography } from 'antd';

const KEY = 'medcare_install_hint_dismissed';

export default function InstallPrompt() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const dismissed = localStorage.getItem(KEY);
    if (!standalone && !dismissed) {
      const t = setTimeout(() => setOpen(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);
  const close = () => { localStorage.setItem(KEY, '1'); setOpen(false); };
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <Modal open={open} onCancel={close} onOk={close} okText="知道了" cancelText="不再提示" cancelButtonProps={{ onClick: close }} title="安装到主屏幕">
      <Typography.Paragraph>
        {isIOS
          ? '在 Safari 底部分享菜单中选择「添加到主屏幕」，即可像 App 一样快速上传报告。'
          : '可通过浏览器地址栏的安装图标，把 MedCare 添加到桌面，快速上传报告。'}
      </Typography.Paragraph>
    </Modal>
  );
}
```
在 `AppLayout` 内容区挂载一次 `<InstallPrompt />`。

- [ ] **Step 4: 验证 + 提交**

`npm run build` 后 `npm run preview`:DevTools → Application → Manifest 图标/颜色正确;Service Worker 已注册;Network 面板确认 `/api` 请求不经过 SW 缓存(offline 勾选时 API 报网络错误而非缓存数据,页面导航仍可打开壳)。

```bash
git add -A client && git commit -m "feat(client): PWA manifest, workbox strategies, generated icons, install prompt"
```

### Task 21: 设置页重构与扩展(账户/授权/邀请码/用户/合并)

**Files:**
- Create: `client/src/pages/Settings/AccountPanel.jsx`、`SelfBindingPanel.jsx`、`AccessPanel.jsx`、`InvitePanel.jsx`、`UsersPanel.jsx`、`MergePanel.jsx`
- Rewrite: `client/src/pages/Settings/Settings.js`(Tabs 组合各面板,保留 OCRSettings Tab)
- Test: 手动验证

**Interfaces:**
- Consumes: `memberAPI`(含 bindSelf)、`inviteAPI`、`userAPI`、`state.auth.role`、`state.familyMembers.list`
- Produces: 无对外接口

- [ ] **Step 1: AccountPanel + SelfBindingPanel**

AccountPanel:displayName 编辑(`PUT /api/users/:id/displayName`?——**无此端点**,改为:displayName 编辑走 `POST /api/auth/update-profile`(后端补,authenticateToken,只允许改自己的 displayName)——在本 Task 给后端 `authController` 加 15 行端点 + 测试一条);修改密码(现有逻辑迁移)。

SelfBindingPanel:`selfMember` 展示;若为 null(老账户)显示引导按钮 → Modal 内两选一(新建/认领,复用 `registerFormLogic.resolveBindOptions({ claimableMembers })` 逻辑,数据来自 `memberAPI` 无 self 成员——**补后端 `GET /api/members?claimable=1`**(authenticateToken,返回无 self link 成员;实现 10 行,放 memberController.list 分支)+ `memberAPI.bindSelf`)。

- [ ] **Step 2: AccessPanel**

两个列表(数据源均为 `GET /api/members` 的可见成员列表,按 `role` 分组):
- 「我管理的」(role ∈ self/owner/admin 且有权限):每成员展开其 links(`GET /api/members/:id/links`,仅 self/owner 可调,403 时跳过 admin 视角)→ 显示被授权人 + 撤销按钮 + 「授权」按钮(Select 用户来自 `userAPI.list()`,Task 12 已实现登录可用、返回基础字段)
- 「共享给我的」(role ∈ viewer/editor):显示授权人成员与我的权限级别

- [ ] **Step 3: InvitePanel / UsersPanel / MergePanel(admin)**

- InvitePanel:Table(码/用途(专属码显示成员名)/次数 usedCount/maxUses/过期/状态)+ 新建 Modal(memberId 可选 Select 自管理成员、maxUses InputNumber、expiresDays InputNumber)+ 停用 Popconfirm
- UsersPanel:Table(username/displayName/role/绑定本人/创建时间)+ role 切换 Select(不能改自己)
- MergePanel:两个 Select(全部成员)+ 合并确认 Modal(明确提示 source 数据将并入 target)→ `POST /api/members/merge`

面板顶部条件渲染:`{role === 'admin' && <Tabs.Items .../>}`。

- [ ] **Step 4: 手动验证 + 提交**

角色矩阵逐项点检:member 账户看不到邀请码/用户/合并 Tab;授权-撤销-可见性联动(与 Task 11 后端行为对齐)。

```bash
git add -A client server && git commit -m "feat: settings panels (account, self-binding, access, invites, users, merge)"
```

### Task 22: CLI 更新 + 文档 + 移除旧路径别名(收尾)

**Files:**
- Modify: `server/cli/medcare.js`、`server/src/app.js`(去 `/api/family-members` 别名)、`README.md`、`skills/medcare-cli.md`
- Test: `server` 全量测试 + CLI 冒烟

**Interfaces:**
- Produces: CLI 新命令 `invites create/list`、`access grant/revoke`、`users list`;文档全面更新

- [ ] **Step 1: CLI 适配**

`server/cli/medcare.js`:
- 全局把 `/family-members` 请求路径改为 `/members`
- 新命令(commander 风格与现有一致):
```js
program.command('invites create')
  .description('生成邀请码')
  .option('--member <id>', '绑定专属成员')
  .option('--uses <n>', '可用次数', '1')
  .option('--days <n>', '有效天数')
  .action(async (opts) => { /* POST /api/invites */ });

program.command('invites list').action(/* GET /api/invites */);
program.command('access grant')
  .requiredOption('--member <id>', '成员ID')
  .requiredOption('--user <id>', '被授权用户ID')
  .requiredOption('--role <role>', 'viewer 或 editor')
  .action(/* POST /api/members/:id/links */);
program.command('access revoke').requiredOption('--link <id>', '授权记录ID')
  .action(/* DELETE /api/members/:id/links/:linkId — link 对应成员需先查 */);
program.command('users list').action(/* GET /api/users */);
```
注:`access revoke` 需成员上下文,实现为 `GET /api/members/:memberId/links` 后按 link id 定位删除——命令参数加 `--member`。

- [ ] **Step 2: 移除别名 + 全量回归**

`app.js` 删除 `app.use('/api/family-members', memberRoutes);`,全局(前后端)搜索确认无 `/family-members` 残留引用。

```bash
cd server && npm test
cd ../client && npm test && npm run build
```

- [ ] **Step 3: 文档更新**

- `README.md`:功能清单(多账户/授权/PWA/快速上传)、项目结构(src/ 分层、api/ 目录)、快速开始(`npm run migrate-v2` 升级说明:旧库先备份迁移,新库 init-db 即 v2)、API 表(新端点)、PWA 安装说明、CLI 新命令
- `skills/medcare-cli.md`:命令参考同步(members 路径、invites、access、users)
- 根 `package.json` 无需变化;Dockerfile 若引用 `client/build` 已在 Task 14 修正为 `dist`

- [ ] **Step 4: 端到端手动验收 + 最终提交**

验收清单(手动,双端):
1. 全新库:首次注册 admin(绑定本人)→ 生成邀请码 → 家人注册(认领/新建)→ 各自只见本人/授权成员
2. 授权 viewer/editor → 可见性与操作权限符合矩阵
3. 移动端(手机或模拟器):PWA 安装 → TabBar → 拍照上传 → 默认本人 → OCR → 保存 → 报告可见
4. admin:成员合并、用户角色、邀请码停用
5. 老库升级:复制 v1 库 → migrate-v2 → 数据完整(成员/报告/links)

```bash
git add -A && git commit -m "chore: CLI v2 commands, docs refresh, remove legacy family-members alias"
```

---

## 任务依赖图

```
Task 1 → 2 → 3 → 4(后端骨架与迁移)
Task 5 → 6(模型 → 权限服务)
Task 7(迁移脚本,依赖 5)
Task 8(邀请码,依赖 5)→ 9(注册,依赖 6+8)→ 10(成员 v2,依赖 6+9)→ 11(links/merge)→ 12(admin API)→ 13(权限切换+finalize,依赖 6+7)
Task 14(Vite)→ 15(authSlice/members)→ 16(布局)→ 17(注册向导,依赖 15)
Task 18(快速上传,依赖 14+15)→ 19(移动适配,依赖 16)
Task 20(PWA,依赖 14)‖ 21(设置页,依赖 12+15)
Task 22(收尾,依赖全部)
```

