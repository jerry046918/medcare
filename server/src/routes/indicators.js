const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/indicatorsController');

const router = express.Router();

// 获取所有指标
router.get('/', authenticateToken, c.list);

// 获取单个指标详情
router.get('/:id', authenticateToken, c.getDetail);

// 创建指标
router.post('/', authenticateToken, c.create);

// 更新指标
router.put('/:id', authenticateToken, c.update);

// 删除指标
router.delete('/:id', authenticateToken, c.remove);

// 为指标添加别名（用于 OCR 识别匹配）
router.post('/:id/alias', authenticateToken, c.addAlias);

// 删除指标的某个别名
router.delete('/:id/alias', authenticateToken, c.removeAlias);

module.exports = router;
