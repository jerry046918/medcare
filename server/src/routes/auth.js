const express = require('express');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/authController');

const router = express.Router();
router.post('/register', authLimiter, c.register);
router.post('/login', authLimiter, c.login);
router.get('/verify', c.verify);
router.get('/init-status', c.initStatus);
router.post('/change-password', authenticateToken, c.changePassword);
module.exports = router;
