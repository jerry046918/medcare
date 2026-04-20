# MedCare - 家庭健康管理系统

全栈家庭健康管理应用，帮助家庭集中管理成员健康信息、医疗报告和健康指标。

## 功能

- **家庭成员管理** - 维护家庭成员基本信息、性别、年龄等
- **医疗报告管理** - 上传报告附件（图片/PDF），自动 OCR 识别指标数据
- **健康指标库** - 内置 135+ 常用医学检验指标，支持性别差异化参考范围
- **智能 OCR** - 支持本地 PaddleOCR 和云端 OpenAI 兼容 API 两种识别引擎
- **数据可视化** - 指标趋势图表，自动标注异常值
- **CLI 工具** - 命令行接口，支持自动化和 Agent 驱动操作
- **安全认证** - JWT 认证，bcrypt 密码加密，接口限流

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18, Redux Toolkit, Ant Design, ECharts |
| 后端 | Express.js, Sequelize ORM, SQLite |
| OCR | PaddleOCR (本地), OpenAI Vision API (云端) |
| CLI | Commander.js (Agent 可通过命令行操作) |

## 快速开始

### 环境要求

- Node.js >= 16
- npm >= 8

### 安装

```bash
git clone <repository-url>
cd medcare

# 安装全部依赖
npm run install-all

# 初始化数据库（含默认指标库）
cd server && npm run init-db && cd ..

# 启动开发服务器（前端 3000 + 后端 3001）
npm run dev
```

首次访问 http://localhost:3000 会引导创建管理员账户。

### OCR 配置（可选）

OCR 功能默认使用本地 PaddleOCR。如需使用云端识别：

1. 进入系统设置 → OCR 设置
2. 选择「云端 OCR」
3. 填入 API 地址和密钥（兼容 OpenAI Vision 格式）

不配置 OCR 也可手动录入指标数据。

## 项目结构

```
medcare/
├── client/                  # React 前端
│   └── src/
│       ├── pages/           # 页面（仪表盘、报告、设置等）
│       ├── services/        # API 调用层
│       ├── store/           # Redux 状态管理
│       └── components/      # 布局和通用组件
├── server/                  # Express 后端
│   ├── cli/                 # medcare CLI 工具
│   ├── config/              # 配置
│   ├── middleware/           # 认证、限流中间件
│   ├── models/              # Sequelize 数据模型
│   ├── routes/              # API 路由
│   ├── scripts/             # 数据库初始化、迁移脚本
│   ├── services/            # 业务逻辑、OCR 引擎
│   └── uploads/             # 上传文件存储（gitignored）
├── docker-compose.yml
└── package.json             # 根级脚本入口
```

## CLI 工具

MedCare 提供 `medcare` 命令行工具，支持脚本化和 Agent 驱动操作：

```bash
# 安装
cd server && npm link

# 登录
medcare login -s http://localhost:3001 -u <user> -p <password>

# 常用命令
medcare members list
medcare reports list --member <id>
medcare reports ocr --file report.jpg
medcare reports upload --member 1 --file report.jpg --date 2026-04-20 \
  --indicator-data '[{"indicatorId":1,"value":"120"}]'
medcare indicators list --search "白细胞"
medcare indicators add --name "新指标" --type "分类" --value-type numeric
```

所有命令默认输出 JSON，追加 `--pretty` 可格式化输出。

## API 概览

所有接口前缀 `/api/`，需 JWT 认证（除 auth 路由外）。

| 路径 | 说明 |
|------|------|
| `/api/auth/*` | 注册、登录、Token 验证 |
| `/api/family-members/*` | 家庭成员 CRUD |
| `/api/reports/*` | 报告 CRUD + 文件上传 |
| `/api/indicators/*` | 指标库 CRUD + 别名管理 |
| `/api/medications/*` | 用药记录 |
| `/api/medical-logs/*` | 医疗日志 |
| `/api/ocr/*` | OCR 识别与配置 |
| `/api/config/*` | 系统配置 |

## 部署

### Docker

```bash
docker-compose up -d
# 访问 http://localhost:3000
```

### 手动部署

```bash
# 构建前端
cd client && npm run build
cp -r build ../server/public/

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
