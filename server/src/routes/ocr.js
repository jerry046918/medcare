/**
 * OCR API 路由
 * 提供图片上传、OCR 识别、指标解析等功能
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { ocrLimiter } = require('../middleware/rateLimiter');
const c = require('../controllers/ocrController');

const router = express.Router();

/**
 * POST /api/ocr/upload
 * 上传图片并进行 OCR 识别
 */
router.post('/upload', authenticateToken, ocrLimiter, c.uploadMiddleware.single('image'), c.upload);

/**
 * POST /api/ocr/parse
 * 解析 OCR 识别结果，提取指标并匹配
 */
router.post('/parse', authenticateToken, c.parse);

/**
 * POST /api/ocr/recognize-and-parse
 * 上传图片，识别并解析（一站式接口）
 */
router.post('/recognize-and-parse', authenticateToken, ocrLimiter, c.uploadMiddleware.single('image'), c.recognizeAndParse);

/**
 * POST /api/ocr/create-indicator
 * 为未匹配的指标创建新指标
 */
router.post('/create-indicator', authenticateToken, c.createIndicator);

/**
 * GET /api/ocr/engines
 * 获取可用的 OCR 引擎列表
 */
router.get('/engines', authenticateToken, c.engines);

/**
 * GET /api/ocr/config
 * 获取 OCR 配置（非敏感信息）
 */
router.get('/config', authenticateToken, c.config);

/**
 * POST /api/ocr/confirm-match
 * 用户确认指标匹配，自动学习别名
 */
router.post('/confirm-match', authenticateToken, c.confirmMatch);

module.exports = router;
