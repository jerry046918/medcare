/**
 * 系统配置 API 路由
 * 管理系统设置，包括 OCR 配置等
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/configController');

const router = express.Router();

/**
 * GET /api/config
 * 获取所有公开配置
 */
router.get('/', authenticateToken, c.list);

/**
 * GET /api/config/:category
 * 获取指定分类的配置
 */
router.get('/:category', authenticateToken, c.getByCategory);

/**
 * PUT /api/config/:key
 * 更新指定配置项
 */
router.put('/:key', authenticateToken, c.update);

/**
 * POST /api/config
 * 创建新配置项
 */
router.post('/', authenticateToken, c.create);

/**
 * DELETE /api/config/:key
 * 删除配置项
 */
router.delete('/:key', authenticateToken, c.remove);

/**
 * POST /api/config/ocr/batch
 * 批量设置 OCR 配置
 */
router.post('/ocr/batch', authenticateToken, c.saveOcrBatch);

/**
 * GET /api/config/ocr/full
 * 获取完整的 OCR 配置（包括敏感信息，用于设置页面）
 */
router.get('/ocr/full', authenticateToken, c.getOcrFull);

module.exports = router;
