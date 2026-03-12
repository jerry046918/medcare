const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { server: serverConfig, checkRequiredEnvVars } = require('./config');
const { sequelize } = require('./models');
const { apiLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const familyMemberRoutes = require('./routes/familyMembers');
const reportRoutes = require('./routes/reports');
const indicatorRoutes = require('./routes/indicators');
const medicationRoutes = require('./routes/medications');
const medicalLogRoutes = require('./routes/medicalLogs');
const hospitalRoutes = require('./routes/hospitals');
const ocrRoutes = require('./routes/ocr');
const configRoutes = require('./routes/config');

// 检查必需的环境变量
checkRequiredEnvVars();

const app = express();
const PORT = serverConfig.port;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 安全相关 HTTP 头
app.use((req, res, next) => {
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY');
  // 防止 MIME 类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS 保护
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // 内容安全策略（基础版）
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;");
  next();
});

// 静态文件服务（用于PDF文件）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API 限流（应用于所有 API 路由）
app.use('/api/', apiLimiter);

// 生产环境静态文件服务（React build）
const fs = require('fs');
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));

  // SPA 路由支持 - 所有非 API 路由返回 index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
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

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: '家庭医疗管理系统服务正常运行' });
});

// 404 处理
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  // Multer 错误处理
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: '文件大小超过限制（最大 10MB）'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: '意外的文件字段'
    });
  }

  // 限流错误
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: '请求过于频繁，请稍后再试'
    });
  }

  console.error('服务器错误:', err);

  // 生产环境不暴露错误详情
  const message = serverConfig.nodeEnv === 'production'
    ? '服务器内部错误'
    : err.message || '服务器内部错误';

  res.status(err.status || 500).json({
    success: false,
    message
  });
});

// 启动服务器
const startServer = async () => {
  try {
    // 同步数据库
    await sequelize.sync({ force: false });
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
      if (serverConfig.nodeEnv !== 'production') {
        console.log(`开发模式: ${serverConfig.nodeEnv}`);
      }
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
};

startServer();
