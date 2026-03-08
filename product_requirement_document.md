# 家庭医疗管理系统产品需求文档 (PRD)

## 项目概述

**项目名称**: 家庭医疗管理系统 (MedCare Family System)  
**版本**: v1.0.0  
**最后更新**: 2025年7月27日  
**项目状态**: 🟢 已完成核心功能开发，正在优化和测试阶段

## 需求背景
家庭用户中如果存在慢性疾病的患者，或者需要长期关注健康指标的成员，往往需要定期前往医院或其他医疗机构进行检查，但是不同医疗机构产生的大量报告和数据，均存储在各自独立的系统中，难以整体统计以及从时间维度上进行查看和比较。

因此在这里我们希望构建一个为家庭用户提供的医疗管理系统，能够帮助用户统一管理和查看自己的检查结果记录，例如尿酸值、血糖值等指标的变化。

## 功能实现状态

### 已完成功能模块 ✅

#### 1. 用户认证系统 ✅
- **实现状态**: 已完成
- **功能描述**: 支持用户注册、登录、JWT身份验证
- **技术实现**: 使用bcrypt密码加密，JWT token认证
- **页面**: 登录页面、注册页面
- **特色功能**: 首次使用引导，系统初始化检查

#### 2. 家庭成员管理 ✅
- **实现状态**: 已完成
- **功能描述**: 完整的家庭成员CRUD操作
- **数据字段**: 姓名、性别、关系、生日、身高、体重、BMI自动计算
- **页面**: 成员列表、成员详情、成员编辑
- **特色功能**: 自动年龄计算、BMI指数计算、成员报告关联

#### 3. 医疗报告管理 ✅
- **实现状态**: 已完成
- **功能描述**: 完整的报告上传、编辑、查看、删除功能
- **数据字段**: 报告日期、医院名称、医生姓名、PDF附件、指标数据
- **页面**: 报告列表、报告详情、报告上传、报告编辑
- **特色功能**: 
  - PDF文件上传和存储
  - 指标数据批量录入
  - 异常状态自动判断
  - 报告筛选和搜索

#### 4. 健康指标管理 ✅
- **实现状态**: 已完成
- **功能描述**: 指标库管理，支持数值型和定性指标
- **数据字段**: 指标名称、单位、类型、正常值范围、测试方法、描述
- **页面**: 指标列表、指标编辑
- **特色功能**: 
  - 预置常用医疗指标
  - 自定义指标创建
  - 异常判断规则配置
  - 指标分类管理

#### 5. 仪表盘 ✅
- **实现状态**: 已完成
- **功能描述**: 系统概览和快速操作入口
- **展示内容**: 家庭成员概览、最近报告、快速操作
- **特色功能**: 数据统计卡片、快速导航

#### 6. 系统设置 ✅
- **实现状态**: 基础功能已完成
- **功能描述**: 用户信息管理、系统配置
- **页面**: 设置页面

### 核心技术特性 🚀

#### 异常状态智能判断 ✅
- **实现状态**: 已完成并优化
- **功能描述**: 根据指标类型和正常值范围自动判断异常状态
- **支持类型**: 
  - 数值型指标：自动判断偏高/偏低
  - 定性指标：自动判断异常/正常
- **实时更新**: 输入时实时计算，保存时持久化

#### 数据完整性保障 ✅
- **前后端验证**: 双重数据验证机制
- **关联完整性**: 外键约束和级联操作
- **异常处理**: 完善的错误处理和用户提示
### 待开发功能 🔄

#### 数据可视化图表 🔄
- **实现状态**: 部分完成
- **当前状态**: 基础框架已搭建，图表功能开发中
- **计划功能**: 
  - 指标趋势折线图
  - 健康状况统计图
  - 异常指标分析图
- **技术方案**: 使用ECharts图表库

#### 数据导入导出 📋
- **实现状态**: 待开发
- **计划功能**: 
  - JSON格式数据导出
  - 数据备份和恢复
  - 批量数据导入
- **优先级**: 中等

#### 高级搜索和筛选 🔍
- **实现状态**: 基础功能已完成
- **已实现**: 按成员、日期、医院筛选
- **待优化**: 多条件组合搜索、保存搜索条件

## 页面架构总览

### 核心页面 ✅

#### 1. 仪表盘 (`/dashboard`) ✅
- **功能**: 系统概览、快速操作、数据统计
- **组件**: 统计卡片、成员列表、最近报告
- **特色**: 响应式布局、快速导航

#### 2. 家庭成员管理 ✅
- **列表页** (`/family-members`): 成员CRUD操作、搜索筛选
- **详情页** (`/family-members/:id`): 成员信息、关联报告、健康趋势
- **编辑页** (`/family-members/:id/edit`): 成员信息编辑

#### 3. 医疗报告管理 ✅
- **列表页** (`/reports`): 报告CRUD操作、多维度筛选
- **详情页** (`/reports/:id`): 报告详情、指标数据展示
- **上传页** (`/reports/upload`): 新报告创建、指标录入
- **编辑页** (`/reports/:id/edit`): 报告编辑、指标修改

#### 4. 健康指标管理 ✅
- **列表页** (`/indicators`): 指标库管理、自定义指标
- **特色功能**: 预置指标、异常规则配置

#### 5. 系统设置 ✅
- **设置页** (`/settings`): 用户信息、系统配置

#### 6. 用户认证 ✅
- **登录页** (`/login`): 用户登录
- **注册页** (`/register`): 首次使用注册

## 技术架构

### 前端技术栈 ✅
- **框架**: React 18.2.0 - 现代化前端框架
- **UI组件库**: Ant Design 5.26.6 - 企业级UI设计语言
- **状态管理**: Redux Toolkit 2.0.1 - 可预测的状态容器
- **路由管理**: React Router 6.20.1 - 声明式路由
- **HTTP客户端**: Axios 1.6.2 - Promise based HTTP client
- **图表库**: ECharts 5.4.3 + echarts-for-react 3.0.2 - 数据可视化
- **日期处理**: Day.js 1.11.10 - 轻量级日期库
- **构建工具**: Create React App 5.0.1 - 零配置构建工具

### 后端技术栈 ✅
- **运行环境**: Node.js - JavaScript运行时
- **Web框架**: Express.js 4.18.2 - 快速、极简的Web框架
- **数据库**: SQLite 3.5.1.6 - 轻量级嵌入式数据库
- **ORM**: Sequelize 6.35.2 - Promise-based ORM
- **身份认证**: JSON Web Token 9.0.2 - 无状态认证
- **密码加密**: bcrypt 5.1.1 - 密码哈希函数
- **文件上传**: Multer 1.4.5 - 多媒体文件处理中间件
- **跨域处理**: CORS 2.8.5 - 跨域资源共享
- **环境配置**: dotenv 16.3.1 - 环境变量管理

### 开发工具链 ✅
- **包管理**: npm/yarn - 依赖包管理
- **开发服务器**: nodemon 3.0.2 - 自动重启开发服务器
- **并发运行**: concurrently 7.6.0 - 同时运行多个命令
- **代码规范**: ESLint - 代码质量检查

### 项目结构 📁
```
medcare/
├── client/                 # 前端React应用
│   ├── src/
│   │   ├── components/    # 可复用组件
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API服务层
│   │   ├── store/         # Redux状态管理
│   │   └── styles/        # 样式文件
│   └── package.json
├── server/                # 后端Node.js应用
│   ├── models/           # 数据模型
│   ├── routes/           # API路由
│   ├── middleware/       # 中间件
│   ├── scripts/          # 数据库脚本
│   ├── uploads/          # 文件上传目录
│   └── package.json
└── package.json          # 根目录配置
```

### 安全特性 🔒
- **密码安全**: bcrypt加密存储，防止明文泄露
- **身份验证**: JWT token机制，无状态认证
- **数据验证**: 前后端双重验证，防止恶意输入
- **文件安全**: 限制上传文件类型和大小
- **本地存储**: 数据存储在本地，避免网络传输风险

## 非功能性需求
### 性能要求
- 系统响应时间应在 2 秒内
- 支持同时管理 100+ 份医疗报告
- 数据库查询优化，支持快速检索

### 安全要求
- 用户密码采用 bcrypt 加密存储
- 敏感医疗数据采用 AES-256 加密
- 本地存储，避免网络传输风险
- 定期数据备份机制

### 可用性要求
- 界面简洁直观，适合各年龄段用户
- 支持键盘快捷键操作
- 错误提示友好明确
- 支持数据导入导出功能

## 数据库设计

### 数据模型关系图
```
Users (用户表)
  ↓ 1:N
FamilyMembers (家庭成员表)
  ↓ 1:N  
MedicalReports (医疗报告表)
  ↓ 1:N
ReportIndicatorData (报告指标数据表)
  ↓ N:1
MedicalIndicators (医疗指标表)
```

### 数据表结构 ✅

#### 用户表 (Users)
```sql
- id: INTEGER PRIMARY KEY AUTOINCREMENT
- username: VARCHAR(50) UNIQUE NOT NULL
- password: VARCHAR(255) NOT NULL  -- bcrypt加密
- createdAt: DATETIME DEFAULT CURRENT_TIMESTAMP
- updatedAt: DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### 家庭成员表 (FamilyMembers)
```sql
- id: INTEGER PRIMARY KEY AUTOINCREMENT
- name: VARCHAR(50) NOT NULL
- gender: ENUM('男', '女') NOT NULL
- relationship: VARCHAR(20) NOT NULL
- birthday: DATE
- height: DECIMAL(5,2)  -- 身高(cm)
- weight: DECIMAL(5,2)  -- 体重(kg)
- userId: INTEGER FOREIGN KEY REFERENCES Users(id)
- createdAt: DATETIME DEFAULT CURRENT_TIMESTAMP
- updatedAt: DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### 医疗报告表 (MedicalReports)
```sql
- id: INTEGER PRIMARY KEY AUTOINCREMENT
- reportDate: DATE NOT NULL
- hospitalName: VARCHAR(100)
- doctorName: VARCHAR(50)
- pdfPath: VARCHAR(255)  -- PDF文件路径
- notes: TEXT
- familyMemberId: INTEGER FOREIGN KEY REFERENCES FamilyMembers(id)
- createdAt: DATETIME DEFAULT CURRENT_TIMESTAMP
- updatedAt: DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### 医疗指标表 (MedicalIndicators)
```sql
- id: INTEGER PRIMARY KEY AUTOINCREMENT
- name: VARCHAR(100) NOT NULL
- unit: VARCHAR(20)
- valueType: ENUM('numeric', 'qualitative') NOT NULL
- testMethod: VARCHAR(100)
- description: TEXT
- normalMin: DECIMAL(15,6)  -- 数值型指标最小正常值
- normalMax: DECIMAL(15,6)  -- 数值型指标最大正常值
- normalValue: ENUM('positive', 'negative')  -- 定性指标正常值
- isDefault: BOOLEAN DEFAULT FALSE
- createdAt: DATETIME DEFAULT CURRENT_TIMESTAMP
- updatedAt: DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### 报告指标数据表 (ReportIndicatorData)
```sql
- id: INTEGER PRIMARY KEY AUTOINCREMENT
- value: VARCHAR(50) NOT NULL  -- 指标值(字符串格式)
- numericValue: DECIMAL(15,6)  -- 数值型指标值
- referenceRange: VARCHAR(100)  -- 参考范围
- isNormal: BOOLEAN  -- 是否正常
- abnormalType: ENUM('normal', 'high', 'low', 'abnormal')  -- 异常类型
- notes: TEXT  -- 备注
- reportId: INTEGER FOREIGN KEY REFERENCES MedicalReports(id)
- indicatorId: INTEGER FOREIGN KEY REFERENCES MedicalIndicators(id)
- createdAt: DATETIME DEFAULT CURRENT_TIMESTAMP
- updatedAt: DATETIME DEFAULT CURRENT_TIMESTAMP
```

### 数据库特性 🚀

#### 自动化功能
- **BMI计算**: 家庭成员BMI自动计算
- **年龄计算**: 根据生日自动计算年龄
- **异常判断**: 指标数据自动判断异常状态
- **数值转换**: 字符串指标值自动转换为数值型

#### 数据完整性
- **外键约束**: 确保数据关联完整性
- **唯一索引**: 防止重复数据
- **级联操作**: 删除时自动处理关联数据
- **数据验证**: 字段级别的数据验证

#### 性能优化
- **索引设计**: 关键字段建立索引
- **查询优化**: 关联查询优化
- **分页支持**: 大数据量分页处理

## 项目进展记录

### ✅ 第一阶段（已完成）- 基础架构
**时间**: 2024年11月  
**状态**: 已完成
- ✅ 项目初始化和环境搭建
- ✅ 前后端技术栈选型和配置
- ✅ 数据库设计和创建
- ✅ 用户认证系统开发
- ✅ 家庭成员管理功能完整实现

### ✅ 第二阶段（已完成）- 核心功能
**时间**: 2024年11月-12月  
**状态**: 已完成
- ✅ 医疗指标管理系统
- ✅ 报告上传和管理功能
- ✅ PDF文件上传和存储
- ✅ 指标数据录入和编辑
- ✅ 异常状态自动判断功能
- ✅ 报告详情查看和编辑

### ✅ 第三阶段（已完成）- 用户体验优化
**时间**: 2024年12月  
**状态**: 已完成
- ✅ 仪表盘和数据概览
- ✅ 响应式界面设计
- ✅ 搜索和筛选功能
- ✅ 系统设置页面
- ✅ 错误处理和用户提示优化
- ✅ 数据验证和安全性增强

### 🔄 第四阶段（进行中）- 高级功能
**时间**: 2024年12月  
**状态**: 部分完成
- ✅ 系统测试和Bug修复
- 🔄 数据可视化图表功能（开发中）
- ⏳ 数据导入导出功能（待开发）
- ⏳ 高级搜索功能（待优化）
- ✅ 文档完善

### 📋 后续规划

#### 短期目标（1-2周）
- 完善数据可视化图表
- 实现数据导入导出功能
- 性能优化和用户体验提升

#### 中期目标（1个月）
- 移动端适配优化
- 高级数据分析功能
- 批量操作功能

#### 长期目标（3个月）
- 多用户权限管理
- 数据同步和备份
- 插件系统和扩展性

## 项目成果总结

### 已交付功能 🎯
1. **完整的家庭医疗管理系统**
2. **用户友好的现代化界面**
3. **智能异常状态判断**
4. **安全的数据存储和管理**
5. **响应式设计支持多设备**

### 技术亮点 ⭐
1. **前后端分离架构**
2. **RESTful API设计**
3. **自动化数据处理**
4. **完善的错误处理机制**
5. **模块化代码结构**

### 用户价值 💡
1. **统一管理家庭健康数据**
2. **智能识别健康异常**
3. **便捷的报告录入和查看**
4. **安全的本地数据存储**
5. **直观的数据展示界面**

## 快速开始指南

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0 或 yarn >= 1.22.0

### 安装和运行
```bash
# 1. 克隆项目
git clone <repository-url>
cd medcare

# 2. 安装依赖
npm install
cd server && npm install
cd ../client && npm install

# 3. 初始化数据库
cd ..
npm run init-db

# 4. 启动开发服务器
npm run dev
```

### 首次使用
1. 访问 http://localhost:3000
2. 创建管理员账户
3. 添加家庭成员
4. 上传第一份医疗报告

### API文档
- 后端服务: http://localhost:3001
- 健康检查: http://localhost:3001/api/health
- API接口遵循RESTful设计规范

## 更新日志

### v1.0.0 (2024-12-XX)
- ✅ 完成核心功能开发
- ✅ 实现异常状态自动判断
- ✅ 优化用户界面和体验
- ✅ 完善数据验证和安全性
- ✅ 添加响应式设计支持

### 下一版本计划 (v1.1.0)
- 🔄 数据可视化图表
- ⏳ 数据导入导出功能
- ⏳ 高级搜索和筛选
- ⏳ 性能优化

---

**文档维护**: 开发团队  
**最后更新**: 2025年7月27日  
**项目状态**: 🟢 核心功能已完成，持续优化中

> 💡 **提示**: 本文档会随着项目进展持续更新，建议定期查看最新版本。