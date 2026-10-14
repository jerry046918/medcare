const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/membersController');
const router = express.Router();
router.get('/', authenticateToken, c.list);
// /merge、/bind-self 必须注册在 /:id 之前，避免路径参数捕获
router.post('/merge', authenticateToken, c.merge);
router.post('/bind-self', authenticateToken, c.bindSelf);
router.get('/:id/links', authenticateToken, c.listLinks);
router.post('/:id/links', authenticateToken, c.grantLink);
router.delete('/:id/links/:linkId', authenticateToken, c.revokeLink);
router.get('/:id', authenticateToken, c.getDetail);
router.post('/', authenticateToken, c.create);
router.put('/:id', authenticateToken, c.update);
router.delete('/:id', authenticateToken, c.remove);
module.exports = router;
