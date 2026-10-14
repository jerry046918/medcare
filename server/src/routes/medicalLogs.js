const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/medicalLogsController');

const router = express.Router();

// 获取指定成员的所有医疗日志
router.get('/member/:memberId', authenticateToken, c.listByMember);

// 获取单个医疗日志
router.get('/:id', authenticateToken, c.getDetail);

// 创建手动医疗日志
router.post('/', authenticateToken, c.create);

// 更新医疗日志
router.put('/:id', authenticateToken, c.update);

// 删除医疗日志
router.delete('/:id', authenticateToken, c.remove);

module.exports = router;
