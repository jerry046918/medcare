# 家庭健康管理系统 (MedCare)

一个基于 React + Node.js + SQLite 的全栈家庭健康管理应用，帮助家庭管理成员的健康信息和医疗报告。

## 功能特性

- 👥 **家庭成员管理** - 添加、编辑、删除家庭成员信息，支持性别区分
- 📋 **医疗报告管理** - 上传、查看、管理医疗报告，支持图片/PDF
- 📊 **健康指标监测** - 管理和跟踪各种健康指标，支持性别区分的参考范围
- 📈 **数据可视化** - 健康趋势图表展示，自动判断指标是否正常
- 🔐 **安全认证** - JWT 用户认证系统，密码 bcrypt 加密
- 💾 **数据导入导出** - 支持数据备份和恢复
- 📱 **响应式设计** - 支持桌面和移动设备
- 🔄 **OCR 报告识别** - 自动识别医疗报告中的文字和数据（支持 PaddleOCR、OpenAI Vision 等）
## 技术栈

### 前端
- React 18
- Redux Toolkit (状态管理)
- Ant Design (UI 组件库)
- React Router (路由)
- Axios (HTTP 客户端)
- ECharts (图表库)
- Day.js (日期处理)

### 后端
- Node.js
- Express.js (Web 框架)
- Sequelize (ORM)
- SQLite (数据库)
- JWT (身份认证)
- Bcrypt (密码加密)
- Multer (文件上传)
- PaddleOCR (图像识别)

## 项目结构

```
medcare/
├── client/                 # 前端 React 应用
│   ├── public/            # 静态文件
│   └── src/
│       ├── components/    # 可复用组件
│       ├── pages/         # 页面组件
│       ├── services/      # API 服务
│       ├── store/         # Redux 状态管理
│       └── styles/        # 样式文件
├── server/                # 后端 Node.js 应用
│   ├── middleware/        # 中间件
│   ├── models/           # 数据模型
│   ├── routes/           # 路由
│   ├── services/         # 业务逻辑 + OCR
│   ├── scripts/          # 脚本文件
│   └── uploads/          # 上传文件 (gitignored)
├── Dockerfile             # Docker 构建
├── docker-compose.yml     # Docker 编排
└── README.md
```

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- Python 3.11+ (用于 OCR 功能)
- PaddleOCR (Docker 自动安装)

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd medcare
   ```

2. **安装依赖**
   ```bash
   # 安装根目录依赖
   npm install
   
   # 安装后端依赖
   cd server
   npm install
   
   # 安装前端依赖
   cd ../client
   npm install
   ```

3. **初始化数据库**
   ```bash
   # 回到根目录
   cd ..
   
   # 初始化数据库和默认数据
   npm run init-db
   ```

4. **启动开发服务器**
   ```bash
   # 同时启动前端和后端开发服务器
   npm run dev
   ```

   或者分别启动：
   ```bash
   # 启动后端服务器 (端口 3001)
   npm run server
   
   # 启动前端服务器 (端口 3000)
   npm run client
   ```

5. **访问应用**
   - 前端应用：http://localhost:3000
   - 后端 API：http://localhost:3001

### 首次使用

1. 访问 http://localhost:3000
2. 系统会提示创建管理员账户
3. 填写用户名和密码完成注册
4. 登录后即可开始使用

## 可用脚本

### 根目录
- `npm run dev` - 同时启动前后端开发服务器
- `npm run server` - 启动后端开发服务器
- `npm run client` - 启动前端开发服务器
- `npm run build` - 构建前端生产版本
- `npm run init-db` - 初始化数据库

### 后端 (server/)
- `npm start` - 启动生产服务器
- `npm run dev` - 启动开发服务器 (nodemon)
- `npm run init-db` - 初始化数据库

### 前端 (client/)
- `npm start` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm test` - 运行测试

## API 接口

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/verify` - 验证 token
- `GET /api/auth/init-status` - 检查系统初始化状态

### 家庭成员接口
- `GET /api/family-members` - 获取所有家庭成员
- `GET /api/family-members/:id` - 获取单个家庭成员
- `POST /api/family-members` - 创建家庭成员
- `PUT /api/family-members/:id` - 更新家庭成员
- `DELETE /api/family-members/:id` - 删除家庭成员

### 医疗报告接口
- `GET /api/reports` - 获取所有报告
- `GET /api/reports/:id` - 获取单个报告
- `POST /api/reports` - 创建报告
- `PUT /api/reports/:id` - 更新报告
- `DELETE /api/reports/:id` - 删除报告

### 健康指标接口
- `GET /api/indicators` - 获取所有指标
- `GET /api/indicators/:id` - 获取单个指标
- `POST /api/indicators` - 创建指标
- `PUT /api/indicators/:id` - 更新指标
- `DELETE /api/indicators/:id` - 删除指标

## 数据库结构

### 用户表 (Users)
- id, username, password, createdAt, updatedAt

### 家庭成员表 (FamilyMembers)
- id, name, gender, relationship, birthday, height, weight, userId

### 医疗报告表 (MedicalReports)
- id, reportDate, hospitalName, doctorName, pdfPath, notes, familyMemberId

### 医疗指标表 (MedicalIndicators)
- id, name, unit, type, valueType, testMethod, description, referenceRange
- normalMin, normalMax (通用/男性参考范围)
- normalMinFemale, normalMaxFemale (女性专用参考范围)
- normalValue (定性指标正常值)
- isDefault

### 报告指标数据表 (ReportIndicatorData)
- id, value, numericValue, referenceRange, isNormal, abnormalType, notes
- reportId, indicatorId
- 注：系统自动根据家庭成员性别选择参考范围判断是否正常

## 部署

### Docker 部署 (推荐)

```bash
# 构建并启动
docker-compose up -d

# 访问
http://localhost:3000
```

### 生产环境部署

1. **构建前端**
   ```bash
   cd client
   npm run build
   ```

2. **配置环境变量**
   ```bash
   # 在 server/ 目录创建 .env 文件
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=<strong-random-key>
   JWT_EXPIRES_IN=7d
   PADDLE_OCR_ENABLED=true
   ```

3. **启动生产服务器**
   ```bash
   cd server
   npm start
   ```

## 环境变量

### 服务器 (server/.env)
```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<strong-random-key>
JWT_EXPIRES_IN=7d
PADDLE_OCR_ENABLED=true
PYTHON_CMD=python3
```

### 客户端 (client/.env)
```env
REACT_APP_API_URL=/api
```

## 安全注意事项

- **JWT_SECRET**: 必须设置为强随机密钥，不要使用默认值
- **默认凭证**: 系统初始化会创建 admin/123456，请在生产环境中修改
- **.env 文件**: 包含敏感信息，确保已添加到 .gitignore

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证。

## 免责声明

本项目仅供学习和个人使用，不提供任何保证。

---

感谢使用家庭健康管理系统！