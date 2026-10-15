/**
 * 系统配置 API 路由
 * 管理系统设置，包括 OCR 配置等
 * 权限模型（Final Finding 3）：配置写入（PUT/POST/DELETE）与 OCR 批量/完整配置
 * 为管理员专属；普通用户可读公开配置与按分类读取（敏感字段脱敏，见 configService）。
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const c = require('../controllers/configController');

const router = express.Router();

/**
 * GET /api/config
 * 获取所有公开配置
 */
router.get('/', authenticateToken, c.list);

/**
 * GET /api/config/:category
 * 获取指定分类的配置（ocr 分类对非管理员脱敏 apiKey）
 */
router.get('/:category', authenticateToken, c.getByCategory);

/**
 * PUT /api/config/:key
 * 更新指定配置项
 */
router.put('/:key', requireAdmin, c.update);

/**
 * POST /api/config
 * 创建新配置项
 */
router.post('/', requireAdmin, c.create);

/**
 * DELETE /api/config/:key
 * 删除配置项
 */
router.delete('/:key', requireAdmin, c.remove);

/**
 * POST /api/config/ocr/batch
 * 批量设置 OCR 配置
 */
router.post('/ocr/batch', requireAdmin, c.saveOcrBatch);

/**
 * GET /api/config/ocr/full
 * 获取完整的 OCR 配置（包括敏感信息，用于设置页面；仅管理员）
 */
router.get('/ocr/full', requireAdmin, c.getOcrFull);

module.exports = router;
