const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/filesController');

const router = express.Router();

// 认证后提供上传文件访问
router.get('/:type/:filename', authenticateToken, c.get);

module.exports = router;
