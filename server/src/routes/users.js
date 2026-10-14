const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const c = require('../controllers/usersController');

const router = express.Router();
router.get('/', authenticateToken, c.list); // 登录即可:普通用户拿基础字段
router.put('/:id/role', requireAdmin, c.setRole);
module.exports = router;
