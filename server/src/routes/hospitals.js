const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/hospitalsController');

const router = express.Router();

// 搜索医院
router.get('/search', authenticateToken, c.search);

// 获取所有省份
router.get('/provinces', authenticateToken, c.provinces);

// 获取所有医院（用于下拉列表）
router.get('/all', authenticateToken, c.all);

module.exports = router;
