const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const familyMemberRoutes = require('./routes/familyMembers');
const reportRoutes = require('./routes/reports');
const indicatorRoutes = require('./routes/indicators');
const medicationRoutes = require('./routes/medications');
const medicalLogRoutes = require('./routes/medicalLogs');
const hospitalRoutes = require('./routes/hospitals');
const ocrRoutes = require('./routes/ocr');
const configRoutes = require('./routes/config');
const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（用于PDF文件）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
const startServer = async () => {
  try {
    // 同步数据库
    await sequelize.sync({ force: false });
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
};

startServer();