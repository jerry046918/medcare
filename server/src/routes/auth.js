const express = require('express');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/authController');

const router = express.Router();
router.post('/register', authLimiter, c.register);
router.post('/login', authLimiter, c.login);
// 公开:注册向导预览邀请码(专属码 → 绑定成员;通用码 → 可认领成员列表)
router.post('/preview-invite', authLimiter, c.previewInvite);
router.get('/me', authenticateToken, c.me);
router.get('/verify', c.verify);
router.get('/init-status', c.initStatus);
router.post('/change-password', authenticateToken, c.changePassword);
module.exports = router;
