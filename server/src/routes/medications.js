const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/medicationsController');

const router = express.Router();

// 获取指定成员的所有用药记录
router.get('/member/:memberId', authenticateToken, c.listByMember);

// 获取单个用药记录
router.get('/:id', authenticateToken, c.getDetail);

// 创建用药记录
router.post('/', authenticateToken, c.create);

// 更新用药记录
router.put('/:id', authenticateToken, c.update);

// 删除用药记录
router.delete('/:id', authenticateToken, c.remove);

module.exports = router;
