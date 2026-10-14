const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { server: serverConfig } = require('./config');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

// 路由（全部位于 src/routes，旧 routes/ 已在 Task 4 删除）
const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/members');
const reportRoutes = require('./routes/reports');
const indicatorRoutes = require('./routes/indicators');
const medicationRoutes = require('./routes/medications');
const medicalLogRoutes = require('./routes/medicalLogs');
const hospitalRoutes = require('./routes/hospitals');
const ocrRoutes = require('./routes/ocr');
const configRoutes = require('./routes/config');
const fileRoutes = require('./routes/files');
const userRoutes = require('./routes/users');
const inviteRoutes = require('./routes/invites');

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
  app.use('/api/family-members', memberRoutes); // Task 10 改为双路径
  app.use('/api/members', memberRoutes); // v2 双路径：/api/members/bind-self 等新端点先行可用
  app.use('/api/reports', reportRoutes);
  app.use('/api/indicators', indicatorRoutes);
  app.use('/api/medications', medicationRoutes);
  app.use('/api/medical-logs', medicalLogRoutes);
  app.use('/api/hospitals', hospitalRoutes);
  app.use('/api/ocr', ocrRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/users', userRoutes); // Task 12:用户管理(登录列表 + admin 改角色)
  app.use('/api/invites', inviteRoutes); // Task 12:邀请码管理(admin)
  app.get('/api/health', (req, res) => res.json({ status: 'OK', message: '家庭医疗管理系统服务正常运行' }));
  app.use('/api/*', (req, res) => res.status(404).json({ success: false, message: '接口不存在' }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
