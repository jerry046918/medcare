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
