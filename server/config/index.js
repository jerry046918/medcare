/**
 * 应用配置模块
 * 集中管理所有环境变量和配置项
 */

const path = require('path');

// 检查必需的环境变量
function checkRequiredEnvVars() {
  const required = ['JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    console.error(`[Config] 错误: 生产环境缺少必需的环境变量: ${missing.join(', ')}`);
    console.error('[Config] 请在 .env 文件中设置这些变量');
    process.exit(1);
  }
}

// 开发环境允许使用默认值（仅限非生产环境）
const isDevelopment = process.env.NODE_ENV !== 'production';

// JWT 配置
const jwtConfig = {
  secret: process.env.JWT_SECRET || (isDevelopment ? 'medcare_dev_secret_key_change_in_production' : null),
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
};

// 如果生产环境没有设置 JWT_SECRET，抛出错误
if (!jwtConfig.secret) {
  console.error('[Config] 错误: 生产环境必须设置 JWT_SECRET 环境变量');
  process.exit(1);
}

// 开发环境警告
if (isDevelopment && !process.env.JWT_SECRET) {
  console.warn('[Config] 警告: 使用默认 JWT_SECRET，生产环境请务必设置环境变量');
}

// 服务器配置
const serverConfig = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development'
};

// 数据库配置
const dbConfig = {
  storage: path.join(__dirname, '../database/medcare.db'),
  logging: process.env.DB_LOGGING === 'true'
};

// OCR 配置
const ocrConfig = {
  paddleocr: {
    enabled: process.env.PADDLE_OCR_ENABLED !== 'false',
    pythonPath: process.env.PYTHON_CMD || 'python'
  }
};

// 文件上传配置
const uploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'],
  allowedDocTypes: ['application/pdf'],
  uploadDir: path.join(__dirname, '../uploads')
};

// 限流配置
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个 IP 在窗口期内最多 100 个请求
  auth: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 10 // 认证接口更严格：最多 10 次尝试
  }
};

// 验证文件魔数（防止 MIME 类型伪造）
const fileMagicNumbers = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/bmp': [[0x42, 0x4D]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF, 需要进一步检查 WEBP 标识
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]] // %PDF
};

// OCR 引擎白名单
const allowedOCREngines = ['paddleocr', 'openai_vision'];

module.exports = {
  // 检查必需环境变量
  checkRequiredEnvVars,

  // 各模块配置
  jwt: jwtConfig,
  server: serverConfig,
  db: dbConfig,
  ocr: ocrConfig,
  upload: uploadConfig,
  rateLimit: rateLimitConfig,
  fileMagicNumbers,
  allowedOCREngines,

  // 便捷访问
  isDevelopment,
  isProduction: !isDevelopment
};
