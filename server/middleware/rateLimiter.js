/**
 * 限流中间件
 * 防止暴力破解和 DoS 攻击
 */

const rateLimit = require('express-rate-limit');
const { rateLimit: rateLimitConfig } = require('../config');

/**
 * 通用 API 限流器
 * 每个 IP 在 15 分钟内最多 100 次请求
 */
const apiLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 使用 IP + 用户代理作为键（提高安全性）
  keyGenerator: (req) => {
    return `${req.ip}-${req.get('User-Agent') || 'unknown'}`;
  },
  handler: (req, res) => {
    console.warn(`[RateLimit] IP ${req.ip} 触发限流: ${req.path}`);
    res.status(429).json({
      success: false,
      message: '请求过于频繁，请稍后再试',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000)
    });
  }
});

/**
 * 认证接口限流器（更严格）
 * 每个 IP 在 15 分钟内最多 10 次请求
 */
const authLimiter = rateLimit({
  windowMs: rateLimitConfig.auth.windowMs,
  max: rateLimitConfig.auth.max,
  message: {
    success: false,
    message: '登录尝试次数过多，请 15 分钟后再试',
    error: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 成功的请求不计入限制
  handler: (req, res) => {
    console.warn(`[RateLimit] IP ${req.ip} 触发认证限流: ${req.path}`);
    res.status(429).json({
      success: false,
      message: '登录尝试次数过多，请 15 分钟后再试',
      error: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(rateLimitConfig.auth.windowMs / 1000)
    });
  }
});

/**
 * OCR 接口限流器（资源密集型）
 * 每个 IP 在 15 分钟内最多 30 次请求
 */
const ocrLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: 30,
  message: {
    success: false,
    message: 'OCR 请求过于频繁，请稍后再试',
    error: 'OCR_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[RateLimit] IP ${req.ip} 触发 OCR 限流: ${req.path}`);
    res.status(429).json({
      success: false,
      message: 'OCR 请求过于频繁，请稍后再试',
      error: 'OCR_RATE_LIMIT_EXCEEDED'
    });
  }
});

/**
 * 文件上传限流器
 * 每个 IP 在 15 分钟内最多 50 次上传
 */
const uploadLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: 50,
  message: {
    success: false,
    message: '文件上传请求过于频繁，请稍后再试',
    error: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimiter,
  authLimiter,
  ocrLimiter,
  uploadLimiter
};
