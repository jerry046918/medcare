const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { jwt: jwtConfig } = require('../config');

// JWT认证中间件
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '访问被拒绝，需要认证token'
      });
    }

    // 验证token
    const decoded = jwt.verify(token, jwtConfig.secret);

    // 查找用户
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 将用户信息添加到请求对象
    req.user = {
      id: user.id,
      username: user.username
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token无效'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token已过期'
      });
    }

    console.error('认证中间件错误:', error);
    return res.status(500).json({
      success: false,
      message: '认证过程中发生错误'
    });
  }
};

module.exports = {
  authenticateToken
};
