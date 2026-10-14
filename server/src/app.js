const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { server: serverConfig } = require('./config');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

// 路由（本 Task 仍指向旧 routes/，Task 3-5 逐个换为新结构）
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
