const { authenticateToken } = require('./auth');
const HttpError = require('../utils/httpError');

// 管理员守卫：先走常规认证，再校验角色（authenticateToken 已把 role 放进 req.user）
const requireAdmin = [authenticateToken, (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new HttpError(403, '需要管理员权限'));
  }
  next();
}];

module.exports = { requireAdmin };
